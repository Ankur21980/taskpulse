import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTaskStore } from "../store/taskStore";

const SAMPLE = `Standup — June 9, 2026

Rahul: The API migration is blocked. Priya, can you review the Q3 budget proposal by Friday?
Priya: Sure. Alex, please send the client update email today.
Alex: Will do. Sam needs to schedule user interviews for next week.
Sam: I'll book five sessions by Wednesday.`;

export function UploadPage() {
  const [text, setText] = useState("");
  const { loading, error, extractFromText, extractFromFile } = useTaskStore();
  const navigate = useNavigate();

  const handleExtract = async () => {
    await extractFromText(text);
    navigate("/review");
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Extract tasks from a meeting</h2>
        <p className="mt-1 text-slate-600">
          Paste notes or upload a transcript (.txt, .vtt, .srt). Gemini will extract action items.
        </p>
      </div>

      <textarea
        className="h-48 w-full rounded-lg border border-slate-300 p-4 font-mono text-sm"
        placeholder="Paste meeting transcript..."
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      {loading && (
        <div className="rounded-lg bg-indigo-50 px-4 py-3 text-indigo-800">
          Gemini is extracting tasks — this may take 5–15 seconds...
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => setText(SAMPLE)}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm"
        >
          Load sample transcript
        </button>
        <label className="cursor-pointer rounded-lg border border-slate-300 px-4 py-2 text-sm">
          Upload file
          <input
            type="file"
            accept=".txt,.vtt,.srt,.png,.jpg,.jpeg"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) {
                await extractFromFile(file);
                navigate("/review");
              }
            }}
          />
        </label>
        <button
          disabled={loading || text.trim().length < 10}
          onClick={handleExtract}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? "Extracting..." : "Extract Tasks"}
        </button>
      </div>

      {error && <p className="text-red-600">{error}</p>}
    </div>
  );
}
