import React from "react";

type Props = {
  title: string;
  message: string;
  onClose: () => void;
};

export function ErrorModal({ title, message, onClose }: Props): JSX.Element {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative card p-6 w-[min(90vw,640px)]">
        <h3 className="text-xl font-semibold mb-2">{title}</h3>
        <pre className="bg-black/30 p-3 rounded-md text-white/80 text-sm whitespace-pre-wrap">
          {message}
        </pre>
        <div className="mt-4 flex justify-end">
          <button className="btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
