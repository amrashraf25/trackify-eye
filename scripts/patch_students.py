import re

with open('src/pages/Students.tsx', 'r', encoding='utf-8') as f:
    src = f.read()

start = src.find('              <div className="space-y-2">')
marker = '              </div>\n\n          {/* -- RIGHT: Detail Panel -- */'
end = src.find(marker, start) + len('              </div>')

old_block = src[start:end]
print(f"Found block: chars {start}–{end}, length {len(old_block)}")

new_block = '''              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredStudents.map((student, index) => {
                  const studentCourses = getStudentCourses(student.id);
                  const score         = getOverallScore(student.id);
                  const sc            = scoreColor(score);
                  const sl            = scoreLabel(score);
                  const isSelected    = selectedStudent?.id === student.id;
                  const initials      = student.full_name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();
                  const R = 22, Circ = 2 * Math.PI * R;
                  const dash = Circ - (score / 100) * Circ;

                  return (
                    <motion.div
                      key={student.id}
                      initial={{ opacity: 0, y: 18, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ delay: index * 0.04, type: "spring", stiffness: 280, damping: 24 }}
                      whileHover={{ y: -6, scale: 1.02, transition: { type: "spring", stiffness: 400, damping: 20 } }}
                      onClick={() => setSelectedStudentId(student.id)}
                      className="relative overflow-hidden rounded-2xl cursor-pointer group"
                      style={{
                        background: isSelected
                          ? `linear-gradient(160deg, ${sc}18 0%, hsl(225 30% 9%) 60%)`
                          : "linear-gradient(160deg, hsl(225 25% 10%) 0%, hsl(225 25% 8%) 100%)",
                        border: `1px solid ${isSelected ? sc + "55" : "hsl(225 20% 14%)"}`,
                        boxShadow: isSelected
                          ? `0 0 0 1px ${sc}30, 0 8px 40px ${sc}20, 0 4px 16px rgba(0,0,0,0.4)`
                          : "0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)",
                      }}
                    >
                      {/* Corner glow */}
                      <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full blur-[40px] pointer-events-none"
                        style={{ background: sc, opacity: isSelected ? 0.14 : 0.05 }} />
                      {/* Top accent stripe */}
                      <div className="absolute top-0 left-8 right-8 h-[2px] rounded-b-full"
                        style={{ background: `linear-gradient(90deg, transparent, ${sc}90, transparent)` }} />

                      <div className="p-5">
                        {/* Avatar + Score ring */}
                        <div className="flex items-start justify-between mb-4">
                          <div className="relative">
                            <div className="w-16 h-16 rounded-2xl overflow-hidden"
                              style={{ boxShadow: `0 0 0 2px hsl(225 25% 8%), 0 0 0 3.5px ${sc}55, 0 8px 20px ${sc}25` }}>
                              {student.avatar_url ? (
                                <img src={student.avatar_url} alt={student.full_name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-xl font-black text-white"
                                  style={{ background: `linear-gradient(135deg, ${sc}60, ${sc}28)` }}>
                                  {initials}
                                </div>
                              )}
                            </div>
                            {student.status === "active" && (
                              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2"
                                style={{ borderColor: "hsl(225 25% 8%)", boxShadow: "0 0 8px #22c55e80" }} />
                            )}
                          </div>

                          {/* Animated SVG score ring */}
                          <div className="relative flex items-center justify-center" style={{ width: 56, height: 56 }}>
                            <svg width="56" height="56" style={{ transform: "rotate(-90deg)" }}>
                              <circle cx="28" cy="28" r={R} fill="none" stroke="hsl(225 20% 15%)" strokeWidth="3.5" />
                              <motion.circle
                                cx="28" cy="28" r={R} fill="none"
                                stroke={sc} strokeWidth="3.5"
                                strokeLinecap="round"
                                strokeDasharray={Circ}
                                initial={{ strokeDashoffset: Circ }}
                                animate={{ strokeDashoffset: dash }}
                                transition={{ delay: 0.2 + index * 0.03, duration: 1, ease: "easeOut" }}
                                style={{ filter: `drop-shadow(0 0 5px ${sc}cc)` }}
                              />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                              <span className="text-sm font-black tabular-nums leading-none" style={{ color: sc }}>{score}</span>
                              <span className="text-[8px] text-white/30 font-bold">%</span>
                            </div>
                          </div>
                        </div>

                        {/* Name & code */}
                        <div className="mb-3">
                          <p className="font-black text-white text-[15px] leading-snug truncate">{student.full_name}</p>
                          <p className="text-[10px] text-white/30 font-mono mt-0.5 truncate">{student.student_code}</p>
                        </div>

                        {/* Score label + status */}
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg"
                            style={{ background: `${sc}18`, color: sc, border: `1px solid ${sc}35` }}>
                            {sl}
                          </span>
                          <span className={`text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border ${
                            student.status === "active"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/25"
                              : "bg-white/5 text-white/30 border-white/10"
                          }`}>
                            {student.status}
                          </span>
                        </div>

                        {/* Progress bar */}
                        <div className="h-1.5 rounded-full overflow-hidden mb-3" style={{ background: "hsl(225 20% 16%)" }}>
                          <motion.div
                            className="h-full rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${score}%` }}
                            transition={{ delay: 0.15 + index * 0.03, duration: 0.8, ease: "easeOut" }}
                            style={{ background: `linear-gradient(90deg, ${sc}aa, ${sc})`, boxShadow: `0 0 8px ${sc}80` }}
                          />
                        </div>

                        {/* Footer stats */}
                        <div className="flex items-center gap-3 pt-2.5 border-t" style={{ borderColor: "hsl(225 20% 14%)" }}>
                          <div className="flex items-center gap-1.5">
                            <GraduationCap className="w-3 h-3 text-white/25" />
                            <span className="text-[10px] text-white/35">Year {student.year_level}</span>
                          </div>
                          <div className="w-px h-3 bg-white/10" />
                          <div className="flex items-center gap-1.5">
                            <BookOpen className="w-3 h-3 text-white/25" />
                            <span className="text-[10px] text-white/35">{studentCourses.length} course{studentCourses.length !== 1 ? "s" : ""}</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>'''

result = src[:start] + new_block + src[end:]

with open('src/pages/Students.tsx', 'w', encoding='utf-8') as f:
    f.write(result)

print("Done. New file length:", len(result))
