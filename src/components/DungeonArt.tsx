export function DungeonArt({ compact = false }: { compact?: boolean }) {
  return (
    <svg
      className={`dungeon-art${compact ? ' compact-art' : ''}`}
      viewBox="0 0 600 410"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="390" cy="96" r="61" className="art-moon" />
      <path
        d="m12 311 103-147 84 111 76-155 136 173 98-121 79 146v92H12Z"
        className="art-mountains"
      />
      <path
        d="m0 342 132-61 103 36 126-47 110 30 129 64v46H0Z"
        className="art-ground"
      />
      <path d="m296 410 70-66-40-28 33-32" className="art-path" />
      <path
        d="M183 291V157h17v-26h24v26h20v-26h24v26h18v134M361 287V120h17V93h24v27h20V93h24v27h17v176"
        className="art-stone"
      />
      <path
        d="M256 289V193h21v-24h23v24h25v-24h23v24h22v104"
        className="art-stone"
      />
      <path d="M282 299v-51a26 26 0 0 1 52 0v51" className="art-door" />
      <path d="M298 299v-49a10 10 0 0 1 20 0v49" className="art-door-light" />
      <path
        d="M206 183h15v29h-15zM244 223h14v29h-14zM385 151h15v29h-15zM427 209h14v29h-14z"
        className="art-windows"
      />
      <path
        d="M192 264h79M369 252h85M279 208h81M194 236h38M383 191h66M215 160v21M404 220v31M248 267v25M340 206v25"
        className="art-mortar"
      />
      <path
        d="M144 307v-58m-12 28h24M482 314v-58m-12 28h24"
        className="art-torch-post"
      />
      <path
        d="M144 257c-19-12-13-26 0-41-2 14 15 18 12 29-1 5-5 9-12 12ZM482 264c-19-12-13-26 0-41-2 14 15 18 12 29-1 5-5 9-12 12Z"
        className="art-flame"
      />
      <path
        d="m83 329 6-22 8 22m419 19 8-30 10 30M91 137l3-8m387-35 4-10M321 66l3-9"
        className="art-sparks"
      />
      {!compact && (
        <>
          <path
            d="m65 366 66-26 40 12m234 18 67-19 71 25"
            className="art-contours"
          />
          <path
            d="m303 351-5-19 9-11 10 12-5 18Zm4-30v-7m-13 25-8 13m29-12 8 10"
            className="art-hero"
          />
        </>
      )}
    </svg>
  );
}
