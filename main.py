"""
main.py  —  Excel → Word Generator
"""

import logging
import os
import subprocess
import sys
import threading
import tkinter as tk
from pathlib import Path
from tkinter import filedialog, messagebox, scrolledtext, ttk
from typing import Optional

from excel_reader import read_excel
from file_watcher import FileWatcher
from pdf_exporter import export_to_pdf
from report_generator import generate_report
from template_processor import process_template, safe_filename


# ── Platform helpers ──────────────────────────────────────────────────────────

def _font(size=10, bold=False):
    if sys.platform == "darwin":  family = "Helvetica Neue"
    elif sys.platform == "win32": family = "Segoe UI"
    else:                         family = "DejaVu Sans"
    return (family, size, "bold") if bold else (family, size)

def _mono(size=9):
    if sys.platform == "darwin":  return ("Menlo", size)
    elif sys.platform == "win32": return ("Consolas", size)
    else:                         return ("DejaVu Sans Mono", size)


# ── Colours ───────────────────────────────────────────────────────────────────

BG       = "#0f0f1a"   # near-black background
SURFACE  = "#1a1a2e"   # card surface
BORDER   = "#2d2d4e"   # card border
ACCENT   = "#6c63ff"   # primary purple
ACCENT2  = "#00d4aa"   # teal  (report button)
ACCENT_H = "#8b85ff"   # hover purple
TEXT     = "#e0e0ff"   # primary text
SUBTEXT  = "#8888bb"   # secondary text
SUCCESS  = "#00d4aa"
WARNING  = "#ffcc00"
ERROR    = "#ff6b6b"
HEADER   = "#16213e"   # header bar


# ── Logging handler ───────────────────────────────────────────────────────────

class _WidgetHandler(logging.Handler):
    COLORS = {
        logging.DEBUG:    "#555577",
        logging.INFO:     "#c0c0e0",
        logging.WARNING:  "#ffcc00",
        logging.ERROR:    "#ff6b6b",
        logging.CRITICAL: "#ff4444",
    }

    def __init__(self, widget):
        super().__init__()
        self._w = widget

    def emit(self, record):
        msg = self.format(record)
        tag = record.levelname

        def _add():
            self._w.configure(state="normal")
            self._w.insert(tk.END, msg + "\n", tag)
            self._w.see(tk.END)
            self._w.configure(state="disabled")

        self._w.after(0, _add)


def _setup_logging(widget):
    root = logging.getLogger()
    root.setLevel(logging.INFO)
    h = _WidgetHandler(widget)
    h.setFormatter(logging.Formatter("%(asctime)s   %(message)s", "%H:%M:%S"))
    root.addHandler(h)
    sh = logging.StreamHandler(sys.stdout)
    sh.setFormatter(logging.Formatter("%(asctime)s   %(message)s", "%H:%M:%S"))
    root.addHandler(sh)


logger = logging.getLogger(__name__)


# ── Core logic ────────────────────────────────────────────────────────────────

def generate_documents(excel_path, template_path, output_dir, export_pdf=False):
    rows = read_excel(excel_path)
    if not rows:
        logger.warning("No data rows found — nothing to generate.")
        return 0
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    done = 0
    for idx, row in enumerate(rows, 1):
        first = next((str(v).strip() for v in row.values() if str(v).strip()), f"row_{idx}")
        name  = safe_filename(first, fallback=f"document_{idx}") + ".docx"
        out   = os.path.join(output_dir, name)
        try:
            process_template(template_path, row, out)
            done += 1
            if export_pdf:
                export_to_pdf(out)
        except Exception:
            logger.exception("Row %d: could not generate '%s'.", idx, name)
    logger.info("✓  %d document(s) saved  →  %s", done, output_dir)
    return done


# ── Reusable widgets ──────────────────────────────────────────────────────────

class FileCard(tk.Frame):
    """A card that shows an icon, label, selected filename, and Browse button."""

    def __init__(self, parent, icon, label, pick_cmd, var, **kw):
        super().__init__(parent, bg=SURFACE, highlightbackground=BORDER,
                         highlightthickness=1, **kw)
        self._var     = var
        self._pick    = pick_cmd
        self._full    = ""        # stores full path for tooltip

        # Left icon
        tk.Label(self, text=icon, bg=SURFACE, fg=ACCENT,
                 font=_font(18)).pack(side="left", padx=(14, 8), pady=12)

        # Middle: label + filename
        mid = tk.Frame(self, bg=SURFACE)
        mid.pack(side="left", fill="both", expand=True, pady=10)

        tk.Label(mid, text=label.upper(), bg=SURFACE, fg=SUBTEXT,
                 font=_font(7, bold=True), anchor="w").pack(fill="x")

        self._name_lbl = tk.Label(mid, text="Click Browse to select…",
                                  bg=SURFACE, fg=SUBTEXT,
                                  font=_font(10), anchor="w")
        self._name_lbl.pack(fill="x")

        # Right: Browse button
        self._btn = _Btn(self, "Browse", pick_cmd,
                         bg=ACCENT, fg="white", hover=ACCENT_H,
                         font=_font(9, bold=True), padx=14, pady=6)
        self._btn.pack(side="right", padx=14, pady=12)

        # Update display when var changes
        var.trace_add("write", self._on_var)

    def _on_var(self, *_):
        full = self._var.get()
        self._full = full
        name = Path(full).name if full else "Click Browse to select…"
        color = TEXT if full else SUBTEXT
        self._name_lbl.configure(text=name, fg=color)

    def set_highlight(self, ok: bool):
        color = SUCCESS if ok else BORDER
        self.configure(highlightbackground=color)


class _Btn(tk.Button):
    """Flat button with hover effect."""

    def __init__(self, parent, text, cmd, bg, fg, hover, **kw):
        super().__init__(parent, text=text, command=cmd,
                         bg=bg, fg=fg,
                         activebackground=hover, activeforeground="white",
                         relief="flat", bd=0, cursor="hand2",
                         font=kw.pop("font", _font(10)), **kw)
        self._bg    = bg
        self._hover = hover
        self.bind("<Enter>", lambda _: self.configure(bg=hover))
        self.bind("<Leave>", lambda _: self.configure(bg=bg))


class _StatusBadge(tk.Frame):
    """Pill-shaped status indicator."""

    def __init__(self, parent):
        super().__init__(parent, bg=BG)
        self._dot = tk.Label(self, text="●", bg=BG, fg=SUBTEXT, font=_font(10))
        self._dot.pack(side="left")
        self._lbl = tk.Label(self, text="Ready", bg=BG, fg=SUBTEXT, font=_font(9))
        self._lbl.pack(side="left", padx=(2, 0))

    def set(self, text, color=SUBTEXT):
        def _upd():
            self._dot.configure(fg=color)
            self._lbl.configure(text=text, fg=color)
        self._dot.after(0, _upd)


# ── Main application ──────────────────────────────────────────────────────────

class App(tk.Tk):

    def __init__(self):
        super().__init__()
        self.title("Excel → Word Generator")
        self.configure(bg=BG)
        self.resizable(True, True)

        h = 720 if sys.platform == "darwin" else 680
        self.geometry(f"720x{h}")
        self.minsize(600, 560)

        self._excel_var    = tk.StringVar()
        self._template_var = tk.StringVar()
        self._output_var   = tk.StringVar(value=str(Path.home() / "Desktop" / "output"))
        self._pdf_var      = tk.BooleanVar(value=False)

        self._watcher: Optional[FileWatcher] = None
        self._watching = False
        self._worker:  Optional[threading.Thread] = None

        self._build()
        _setup_logging(self._log)
        logger.info("Ready — select your files and click Generate.")

        if sys.platform == "darwin":
            try:
                self.createcommand("tk::mac::Quit", self.on_closing)
            except Exception:
                pass

    # ── UI ────────────────────────────────────────────────────────────────────

    def _build(self):
        self.columnconfigure(0, weight=1)
        self.rowconfigure(3, weight=1)

        # ── Header bar ────────────────────────────────────────────────────────
        hdr = tk.Frame(self, bg=HEADER, pady=0)
        hdr.grid(row=0, column=0, sticky="ew")
        hdr.columnconfigure(1, weight=1)

        # Left: icon + title
        left = tk.Frame(hdr, bg=HEADER, padx=20, pady=14)
        left.grid(row=0, column=0, sticky="w")
        tk.Label(left, text="⚡", bg=HEADER, fg=ACCENT,
                 font=_font(16)).pack(side="left", padx=(0, 8))
        tk.Label(left, text="Excel  →  Word Generator",
                 bg=HEADER, fg=TEXT,
                 font=_font(13, bold=True)).pack(side="left")

        # Right: status badge
        self._badge = _StatusBadge(hdr)
        self._badge.grid(row=0, column=2, padx=20, sticky="e")

        # ── File cards ────────────────────────────────────────────────────────
        cards_frame = tk.Frame(self, bg=BG, padx=20, pady=16)
        cards_frame.grid(row=1, column=0, sticky="ew")
        cards_frame.columnconfigure(0, weight=1)

        self._excel_card = FileCard(
            cards_frame, "📊", "Excel File",
            self._pick_excel, self._excel_var)
        self._excel_card.grid(row=0, column=0, sticky="ew", pady=(0, 10))

        self._tmpl_card = FileCard(
            cards_frame, "📄", "Word Template",
            self._pick_template, self._template_var)
        self._tmpl_card.grid(row=1, column=0, sticky="ew", pady=(0, 10))

        self._out_card = FileCard(
            cards_frame, "📁", "Output Folder",
            self._pick_output, self._output_var)
        self._out_card.grid(row=2, column=0, sticky="ew")
        # Pre-highlight output (already has a default value)
        self._output_var.trace_add("write", lambda *_: self._out_card.set_highlight(bool(self._output_var.get())))
        self._excel_var.trace_add("write",    lambda *_: self._excel_card.set_highlight(True))
        self._template_var.trace_add("write", lambda *_: self._tmpl_card.set_highlight(True))

        # ── Options row ───────────────────────────────────────────────────────
        opt = tk.Frame(self, bg=BG, padx=20, pady=6)
        opt.grid(row=2, column=0, sticky="ew")

        _Checkbutton(opt, "Export to PDF  (requires MS Word or LibreOffice)",
                     self._pdf_var).pack(side="left")

        # ── Action buttons ────────────────────────────────────────────────────
        act = tk.Frame(self, bg=BG, padx=20, pady=10)
        act.grid(row=2, column=0, sticky="ew", pady=(40, 0))

        self._gen_btn = _Btn(act, "▶   Generate Docs", self._run_once,
                             bg=ACCENT, fg="white", hover=ACCENT_H,
                             font=_font(11, bold=True), padx=20, pady=10)
        self._gen_btn.pack(side="left", padx=(0, 10))

        self._report_btn = _Btn(act, "📋  Generate Report", self._run_report,
                                bg=ACCENT2, fg="#0f0f1a", hover="#00f0c0",
                                font=_font(11, bold=True), padx=20, pady=10)
        self._report_btn.pack(side="left", padx=(0, 10))

        self._watch_btn = _Btn(act, "👁   Watch", self._toggle_watch,
                               bg=SURFACE, fg=TEXT, hover=BORDER,
                               font=_font(10), padx=16, pady=10)
        self._watch_btn.pack(side="left", padx=(0, 10))

        _Btn(act, "📂  Open Output", self._open_output,
             bg=SURFACE, fg=TEXT, hover=BORDER,
             font=_font(10), padx=16, pady=10).pack(side="left")

        # ── Progress bar ──────────────────────────────────────────────────────
        pb_frame = tk.Frame(self, bg=BG, padx=20)
        pb_frame.grid(row=2, column=0, sticky="ew", pady=(100, 0))
        pb_frame.columnconfigure(0, weight=1)

        style = ttk.Style()
        style.theme_use("clam")
        style.configure("Custom.Horizontal.TProgressbar",
                         troughcolor=SURFACE, background=ACCENT,
                         bordercolor=BORDER, lightcolor=ACCENT,
                         darkcolor=ACCENT, thickness=4)

        self._progress = ttk.Progressbar(pb_frame, style="Custom.Horizontal.TProgressbar",
                                          mode="indeterminate", length=200)
        self._progress.grid(row=0, column=0, sticky="ew")

        # ── Log area ──────────────────────────────────────────────────────────
        log_frame = tk.Frame(self, bg=BG)
        log_frame.grid(row=3, column=0, sticky="nsew", padx=20, pady=(10, 16))
        log_frame.rowconfigure(1, weight=1)
        log_frame.columnconfigure(0, weight=1)

        # Log header
        log_hdr = tk.Frame(log_frame, bg=BG)
        log_hdr.grid(row=0, column=0, sticky="ew", pady=(0, 6))
        tk.Label(log_hdr, text="Activity Log", bg=BG, fg=SUBTEXT,
                 font=_font(9, bold=True)).pack(side="left")
        _Btn(log_hdr, "Clear", self._clear_log,
             bg=SURFACE, fg=SUBTEXT, hover=BORDER,
             font=_font(8), padx=8, pady=2).pack(side="right")

        self._log = scrolledtext.ScrolledText(
            log_frame, state="disabled", font=_mono(9),
            bg=SURFACE, fg=TEXT, insertbackground=TEXT,
            selectbackground=BORDER, relief="flat", borderwidth=0,
            wrap="word", padx=10, pady=8)
        self._log.grid(row=1, column=0, sticky="nsew")

        for lvl, col in _WidgetHandler.COLORS.items():
            self._log.tag_configure(logging.getLevelName(lvl), foreground=col)

    # ── File pickers ──────────────────────────────────────────────────────────

    def _pick_excel(self):
        p = filedialog.askopenfilename(
            title="Select your Excel file",
            filetypes=[("Excel files", "*.xlsx *.xls *.xlsm"), ("All files", "*.*")])
        if p:
            self._excel_var.set(p)
            logger.info("Excel:    %s", Path(p).name)

    def _pick_template(self):
        p = filedialog.askopenfilename(
            title="Select your Word template",
            filetypes=[("Word documents", "*.docx"), ("All files", "*.*")])
        if p:
            self._template_var.set(p)
            logger.info("Template: %s", Path(p).name)

    def _pick_output(self):
        p = filedialog.askdirectory(title="Select output folder")
        if p:
            self._output_var.set(p)
            logger.info("Output:   %s", p)

    def _open_output(self):
        folder = self._output_var.get()
        Path(folder).mkdir(parents=True, exist_ok=True)
        if sys.platform == "darwin":
            subprocess.Popen(["open", folder])
        elif sys.platform == "win32":
            os.startfile(folder)
        else:
            subprocess.Popen(["xdg-open", folder])

    def _clear_log(self):
        self._log.configure(state="normal")
        self._log.delete("1.0", tk.END)
        self._log.configure(state="disabled")

    # ── Progress & status helpers ─────────────────────────────────────────────

    def _busy(self, on: bool):
        def _upd():
            if on:
                self._progress.start(12)
            else:
                self._progress.stop()
                self._progress["value"] = 0
        self._log.after(0, _upd)

    def _status(self, text, color=SUBTEXT):
        self._badge.set(text, color)

    # ── Validation ────────────────────────────────────────────────────────────

    def _validate(self):
        excel = self._excel_var.get().strip()
        tmpl  = self._template_var.get().strip()

        if not excel:
            messagebox.showwarning("Missing File",
                "Please select an Excel file.\n\nClick the Browse button on the Excel File card.")
            return None, None
        if not Path(excel).exists():
            messagebox.showerror("Not Found", f"Excel file not found:\n{excel}")
            return None, None
        if not tmpl:
            messagebox.showwarning("Missing File",
                "Please select a Word template.\n\nClick the Browse button on the Word Template card.")
            return None, None
        if not Path(tmpl).exists():
            messagebox.showerror("Not Found", f"Template not found:\n{tmpl}")
            return None, None
        return excel, tmpl

    # ── Generate individual docs ──────────────────────────────────────────────

    def _run_once(self):
        if self._worker and self._worker.is_alive():
            logger.warning("Already running — please wait.")
            return
        excel, tmpl = self._validate()
        if excel:
            self._launch_worker(excel, tmpl)

    def _launch_worker(self, excel, tmpl):
        output = self._output_var.get().strip() or str(Path.home() / "Desktop" / "output")
        pdf    = self._pdf_var.get()

        def _task():
            self.after(0, lambda: self._gen_btn.configure(state="disabled"))
            self._status("Generating…", ACCENT)
            self._busy(True)
            try:
                n = generate_documents(excel, tmpl, output, pdf)
                self._status(f"Done — {n} file(s) ✓", SUCCESS)
            except FileNotFoundError as e:
                logger.error("%s", e)
                self._status("Error", ERROR)
                self.after(0, lambda: messagebox.showerror("Not Found", str(e)))
            except Exception:
                logger.exception("Unexpected error.")
                self._status("Error — see log", ERROR)
            finally:
                self._busy(False)
                self.after(0, lambda: self._gen_btn.configure(state="normal"))

        self._worker = threading.Thread(target=_task, daemon=True)
        self._worker.start()

    # ── Generate Excel report ─────────────────────────────────────────────────

    def _run_report(self):
        if self._worker and self._worker.is_alive():
            logger.warning("Already running — please wait.")
            return

        excel = self._excel_var.get().strip()
        if not excel:
            messagebox.showwarning("Missing File", "Please select an Excel file first.")
            return
        if not Path(excel).exists():
            messagebox.showerror("Not Found", f"Excel file not found:\n{excel}")
            return

        output      = self._output_var.get().strip() or str(Path.home() / "Desktop" / "output")
        report_path = os.path.join(output, "report.xlsx")

        def _task():
            self.after(0, lambda: self._report_btn.configure(state="disabled"))
            self._status("Building report…", ACCENT2)
            self._busy(True)
            try:
                rows = read_excel(excel)
                if not rows:
                    logger.warning("No data rows found.")
                    self._status("No data", WARNING)
                    return
                generate_report(rows, report_path, title="Report")
                self._status("Report ready ✓", SUCCESS)
                logger.info("✓  report.xlsx saved  →  %s", output)
            except Exception:
                logger.exception("Failed to generate report.")
                self._status("Error — see log", ERROR)
            finally:
                self._busy(False)
                self.after(0, lambda: self._report_btn.configure(state="normal"))

        self._worker = threading.Thread(target=_task, daemon=True)
        self._worker.start()

    # ── File watcher ──────────────────────────────────────────────────────────

    def _toggle_watch(self):
        if not self._watching:
            excel, tmpl = self._validate()
            if not excel:
                return
            self._launch_worker(excel, tmpl)

            def _on_change():
                logger.info("Excel changed — regenerating…")
                self._launch_worker(self._excel_var.get(), self._template_var.get())

            try:
                self._watcher = FileWatcher(excel, _on_change)
                self._watcher.start()
            except Exception:
                logger.exception("Could not start file watcher.")
                return

            self._watching = True
            self._watch_btn.configure(text="⏹   Stop Watch", bg="#cc4444")
            self._status("Watching…", WARNING)
        else:
            if self._watcher:
                self._watcher.stop()
                self._watcher = None
            self._watching = False
            self._watch_btn.configure(text="👁   Watch", bg=SURFACE)
            self._status("Idle", SUBTEXT)

    # ── Close ─────────────────────────────────────────────────────────────────

    def on_closing(self):
        if self._watcher:
            self._watcher.stop()
        self.destroy()


# ── Reusable checkbutton ──────────────────────────────────────────────────────

class _Checkbutton(tk.Checkbutton):
    def __init__(self, parent, text, var):
        super().__init__(parent, text=text, variable=var,
                         bg=BG, fg=SUBTEXT, selectcolor=SURFACE,
                         activebackground=BG, activeforeground=TEXT,
                         font=_font(9), cursor="hand2")


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    app = App()
    app.protocol("WM_DELETE_WINDOW", app.on_closing)
    app.mainloop()
