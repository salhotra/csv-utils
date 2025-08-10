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
    <div className="px-6 pt-4 pb-2">
      <div className="flex flex-wrap items-center gap-3">
        <input
          className="input flex-1 min-w-[240px]"
          placeholder="Search text"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
        {searchText && (
          <button className="chip" onClick={() => setSearchText("")}>
            Clear
          </button>
        )}
        {rightSide}
        <div className="text-sm text-slate-600 dark:text-white/60 ml-auto">
          {rowSummary}
        </div>
      </div>
    </div>
  );
}
