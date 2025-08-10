import React from "react";

type Props = {
  searchText: string;
  setSearchText: (v: string) => void;
  rightSide?: React.ReactNode;
  rowSummary: string;
};

export function SearchBar({
  searchText,
  setSearchText,
  rightSide,
  rowSummary,
}: Props): JSX.Element {
  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          className="input flex-1 min-w-[240px]"
          placeholder="Search text"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
        {searchText && (
          <button
            className="chip hover:bg-white/20"
            onClick={() => setSearchText("")}
          >
            Clear
          </button>
        )}
        {rightSide}
        <div className="text-sm text-white/60 ml-auto">{rowSummary}</div>
      </div>
    </div>
  );
}
