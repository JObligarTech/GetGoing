const PLACES = ["Fuglen Tokyo", "Meiji Jingu", "Shibuya Sky", "Afuri Ramen Harajuku", "Cafe Kitsuné", "Pokémon Center Shibuya", "Hotel Gracery Shinjuku", "Golden Gai", "Tsukiji Outer Market", "Nakameguro canal"];

/** A slow strip of the demo trip's saved places. Pure CSS; pauses under reduced motion. */
export function Marquee() {
  const row = [...PLACES, ...PLACES];
  return (
    <div className="marquee border-y border-line py-3" aria-label={`Saved places on the demo trip: ${PLACES.join(", ")}`} role="img">
      <div className="marquee-track" aria-hidden="true">
        {row.map((p, i) => (
          <span key={i} className="mx-3 inline-flex h-8 items-center rounded-pill bg-tint px-3.5 text-[13px] font-bold whitespace-nowrap text-on-tint">{p}</span>
        ))}
      </div>
    </div>
  );
}
