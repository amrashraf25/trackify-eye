with open('src/components/doctors/DoctorBehaviorSection.tsx', 'r', encoding='utf-8') as f:
    src = f.read()

return_start = src.find('  return (\n    <motion.div initial={{ opacity: 0, x: 20 }}')
end_marker = '\nexport default DoctorBehaviorSection;'
end_pos = src.find(end_marker)
print(f'Found JSX: chars {return_start} to {end_pos}')

new_jsx = r'''  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
      className="rounded-2xl border border-white/[0.07] overflow-hidden"
      style={{ background: "hsl(225 25% 8%)" }}
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/[0.05] flex items-center justify-between"
        style={{ background: "linear-gradient(90deg, hsl(263 70% 58% / 0.07), transparent)" }}>
        <h3 className="font-bold text-white flex items-center gap-2 text-sm">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: "hsl(263 70% 58% / 0.15)", boxShadow: "0 0 12px hsl(263 70% 58% / 0.3)" }}>
            <TrendingDown className="w-3.5 h-3.5 text-violet-400" />
          </div>
          {selectedCourseName ? `Behavior \u2014 ${selectedCourseName}` : "Behavior Score"}
        </h3>
        <div className="flex items-center gap-2">
          <SendDoctorAlert doctorId={doctorId} doctorName={doctorName} score={displayScore} />
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 text-xs rounded-lg text-white/25 hover:text-white/70 gap-1">
                <RotateCcw className="w-3 h-3" />Reset
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset Behavior Score</AlertDialogTitle>
                <AlertDialogDescription>
                  This will delete {selectedCourseName ? `behavior records for ${selectedCourseName}` : "all behavior records"} for <strong>{doctorName}</strong> and reset the score.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleReset}>Reset</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-7 text-[10px] rounded-lg bg-primary/15 text-primary border border-primary/25 hover:bg-primary/25 gap-1">
                <Plus className="w-3 h-3" />Record
              </Button>
            </DialogTrigger>
            <DialogContent className="glass">
              <DialogHeader><DialogTitle>Record Behavior \u2014 {doctorName}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Course *</Label>
                  <Select value={action.course_id} onValueChange={(v) => setAction({ ...action, course_id: v })}>
                    <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select course..." /></SelectTrigger>
                    <SelectContent>
                      {doctorCourses.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name} ({c.course_code})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Action</Label>
                  <Input value={action.action_name} onChange={(e) => setAction({ ...action, action_name: e.target.value })}
                    placeholder="e.g. Late to class, Excellent teaching..." className="rounded-xl" />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Type</Label>
                    <Select value={action.action_type} onValueChange={(v) => setAction({ ...action, action_type: v, score_change: v === "positive" ? "5" : "-5" })}>
                      <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="positive">Positive</SelectItem>
                        <SelectItem value="negative">Negative</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Score</Label>
                    <Input type="number" value={action.score_change} onChange={(e) => setAction({ ...action, score_change: e.target.value })} className="rounded-xl" />
                  </div>
                  <div>
                    <Label>Week</Label>
                    <Select value={action.week_number} onValueChange={(v) => setAction({ ...action, week_number: v })}>
                      <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {weeks.map((w) => <SelectItem key={w} value={String(w)}>Week {w}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Notes (optional)</Label>
                  <Textarea value={action.notes} onChange={(e) => setAction({ ...action, notes: e.target.value })}
                    placeholder="Additional notes..." className="rounded-xl" />
                </div>
                <Button onClick={() => addRecord.mutate()} className="w-full rounded-xl">Submit</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Course filter pills */}
        <div>
          <p className="text-[9px] uppercase tracking-[0.18em] text-white/25 font-bold mb-2 flex items-center gap-1.5">
            <BookOpen className="w-3 h-3" />Filter by Course
          </p>
          <div className="flex gap-1.5 flex-wrap">
            {["all", ...doctorCourses.map(c => c.id)].map((cid) => {
              const isAct = selectedCourseId === cid;
              const course = cid === "all" ? null : doctorCourses.find(c => c.id === cid);
              return (
                <button key={cid} onClick={() => setSelectedCourseId(cid)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                    isAct ? "bg-primary text-white shadow-[0_0_10px_hsl(217_91%_60%/0.4)]"
                           : "bg-white/[0.05] text-white/40 hover:bg-white/[0.09] hover:text-white/70"
                  }`}>
                  {cid === "all" ? "All" : course?.course_code || cid}
                </button>
              );
            })}
          </div>
        </div>

        {/* Week heatmap */}
        <div>
          <p className="text-[9px] uppercase tracking-[0.18em] text-white/25 font-bold mb-2">Week Heatmap</p>
          <div className="grid grid-cols-8 gap-1.5">
            {weeks.map((w) => {
              const weekRecs = selectedCourseId !== "all"
                ? records.filter((r: any) => r.week_number === w && r.course_id === selectedCourseId)
                : records.filter((r: any) => r.week_number === w);
              const weekScore = weekRecs.length > 0
                ? Math.max(0, Math.min(100, 100 + weekRecs.reduce((sum: number, r: any) => sum + r.score_change, 0)))
                : null;
              const isActive = selectedWeek === String(w);
              const sc = weekScore !== null ? (weekScore >= 80 ? "#22c55e" : weekScore >= 60 ? "#f59e0b" : "#ef4444") : null;
              return (
                <motion.button key={w}
                  whileHover={{ scale: 1.15 }}
                  whileTap={{ scale: 0.92 }}
                  onClick={() => setSelectedWeek(isActive ? "all" : String(w))}
                  className="relative aspect-square rounded-lg text-[9px] font-black flex items-center justify-center transition-all"
                  style={{
                    background: isActive ? "hsl(217 91% 60%)"
                      : sc ? `${sc}22`
                      : "hsl(225 20% 12%)",
                    color: isActive ? "#fff" : (sc ?? "hsl(218 11% 40%)"),
                    boxShadow: isActive ? "0 0 12px hsl(217 91% 60% / 0.6)" : (sc ? `0 0 6px ${sc}40` : "none"),
                  }}>
                  W{w}
                  {sc && !isActive && (
                    <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full" style={{ background: sc }} />
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Score display */}
        <div className="p-4 rounded-xl border border-white/[0.05]" style={{ background: "hsl(225 25% 6%)" }}>
          <p className="text-[9px] uppercase tracking-[0.18em] text-white/25 font-bold mb-2">
            {selectedCourseName ? `${selectedCourseName} Score` : selectedWeek !== "all" ? `Week ${selectedWeek} Score` : "Overall Score"}
          </p>
          <div className="flex items-center gap-3 mb-1">
            <div className="h-2 flex-1 rounded-full overflow-hidden" style={{ background: "hsl(225 20% 14%)" }}>
              <motion.div className="h-full rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${displayScore}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                style={{
                  background: displayScore >= 80 ? "#22c55e" : displayScore >= 60 ? "#f59e0b" : "#ef4444",
                  boxShadow: `0 0 8px ${displayScore >= 80 ? "#22c55e" : displayScore >= 60 ? "#f59e0b" : "#ef4444"}80`,
                }} />
            </div>
            <span className="text-xl font-black tabular-nums"
              style={{ color: displayScore >= 80 ? "#22c55e" : displayScore >= 60 ? "#f59e0b" : "#ef4444" }}>
              {displayScore}%
            </span>
          </div>
          {selectedCourseId === "all" && doctorCourses.length > 0 && (
            <div className="mt-3 pt-3 border-t border-white/[0.06] space-y-2">
              <p className="text-[9px] uppercase tracking-[0.18em] text-white/25 font-bold">Per Course</p>
              {doctorCourses.map((course) => {
                let cr = records.filter((r: any) => r.course_id === course.id);
                if (selectedWeek !== "all") cr = cr.filter((r: any) => r.week_number === parseInt(selectedWeek));
                const courseScore = cr.length > 0
                  ? Math.max(0, Math.min(100, 100 + cr.reduce((sum: number, r: any) => sum + r.score_change, 0)))
                  : 100;
                const cc = cr.length > 0 ? (courseScore >= 80 ? "#22c55e" : courseScore >= 60 ? "#f59e0b" : "#ef4444") : "hsl(218 11% 35%)";
                return (
                  <div key={course.id} className="flex items-center gap-3 p-2 rounded-lg border border-white/[0.04]" style={{ background: "hsl(225 25% 7%)" }}>
                    <span className="text-[10px] font-bold text-white/60 w-14 flex-shrink-0 font-mono">{course.course_code}</span>
                    <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "hsl(225 20% 14%)" }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${courseScore}%`, background: cc }} />
                    </div>
                    <span className="text-[10px] font-black w-10 text-right flex-shrink-0" style={{ color: cc }}>
                      {cr.length > 0 ? `${courseScore}%` : "\u2014"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* History */}
        {filteredRecords.length > 0 ? (
          <div className="space-y-2 max-h-[240px] overflow-y-auto">
            <p className="text-[9px] uppercase tracking-[0.18em] text-white/25 font-bold">Recent Records</p>
            {filteredRecords.map((record: any) => (
              <div key={record.id} className="flex items-start gap-3 p-3 rounded-xl border border-white/[0.04] hover:border-white/[0.08] transition-all"
                style={{ background: "hsl(225 25% 6%)" }}>
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  record.action_type === "positive" ? "bg-emerald-500/15" : "bg-red-500/15"
                }`}>
                  {record.action_type === "positive"
                    ? <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                    : <TrendingDown className="w-3.5 h-3.5 text-red-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white/80">{record.action_name}</p>
                  <p className="text-[10px] text-white/35 mt-0.5">
                    {record.score_change > 0 ? "+" : ""}{record.score_change}% \u2022 Week {record.week_number ?? "\u2014"} \u2022 {format(new Date(record.created_at), "MMM dd, yyyy")}
                  </p>
                  {record.notes && <p className="text-[10px] text-white/25 mt-0.5 italic">{record.notes}</p>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-white/25 text-center py-2">
            {selectedCourseId !== "all" || selectedWeek !== "all" ? "No records for this filter" : "No behavior records yet"}
          </p>
        )}
      </div>
    </motion.div>
  );
'''

result = src[:return_start] + new_jsx + src[end_pos:]

with open('src/components/doctors/DoctorBehaviorSection.tsx', 'w', encoding='utf-8') as f:
    f.write(result)
print('Done. Length:', len(result))
