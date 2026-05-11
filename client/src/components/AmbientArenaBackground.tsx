export function AmbientArenaBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="arena-grid-overlay absolute inset-0" />
      <div className="arena-radial-glow arena-radial-glow-a absolute -left-24 top-16 h-72 w-72 rounded-full" />
      <div className="arena-radial-glow arena-radial-glow-b absolute right-[-6rem] top-1/3 h-80 w-80 rounded-full" />
      <div className="arena-radial-glow arena-radial-glow-c absolute bottom-[-5rem] left-1/3 h-96 w-96 rounded-full" />
      <div className="arena-beam arena-beam-a absolute left-[10%] top-0 h-full w-24 -skew-x-12" />
      <div className="arena-beam arena-beam-b absolute right-[14%] top-0 h-full w-20 skew-x-[-10deg]" />
      <div className="arena-orb arena-orb-a absolute left-[14%] top-[18%] h-2.5 w-2.5 rounded-full" />
      <div className="arena-orb arena-orb-b absolute right-[22%] top-[26%] h-3 w-3 rounded-full" />
      <div className="arena-orb arena-orb-c absolute left-[46%] bottom-[22%] h-2 w-2 rounded-full" />
      <div className="arena-orb arena-orb-d absolute right-[38%] bottom-[14%] h-2.5 w-2.5 rounded-full" />
    </div>
  );
}
