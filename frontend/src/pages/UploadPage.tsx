import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { TeamMemberPicker } from "../components/TeamMemberPicker";
import { ExtractionLoadingOverlay } from "../components/ExtractionLoadingOverlay";
import { useTaskStore } from "../store/taskStore";
import { Button, buttonVariants } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type UploadMode = "transcript" | "prd";

const SAMPLE = `Sprint Planning — June 9, 2026 (3-week sprint ends June 30)

Hiren: I'll own the dashboard responsive layout — target done by end of week 2.
Prerana: Auth API endpoints need to ship by June 20 so frontend can integrate.
Anisha: I'll build the settings page and shared form components this sprint.
Gowtham: I can write unit tests for the upload flow with Anisha reviewing.`;

export function UploadPage() {
  const [mode, setMode] = useState<UploadMode>("transcript");
  const [text, setText] = useState("");
  const [eligibleIds, setEligibleIds] = useState<Set<string>>(new Set());
  const {
    loading,
    error,
    members,
    loadMembers,
    extractFromText,
    extractFromFile,
    extractFromPrd,
  } = useTaskStore();
  const navigate = useNavigate();

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  useEffect(() => {
    if (members.length > 0 && eligibleIds.size === 0) {
      setEligibleIds(new Set(members.map((m) => m.id)));
    }
  }, [members, eligibleIds.size]);

  const eligibleList = [...eligibleIds];
  const canExtract = eligibleList.length > 0;

  const handleExtract = async () => {
    await extractFromText(text, eligibleList);
    navigate("/review");
  };

  const loadingMsg =
    mode === "prd"
      ? "Extracting tasks from PRD — this may take 15–30 seconds..."
      : "Gemini is extracting tasks — this may take 5–15 seconds...";

  return (
    <div className="space-y-6">
      <Tabs value={mode} onValueChange={(v) => setMode(v as UploadMode)} className="gap-0">
        <TabsList variant="line" className="w-full justify-start rounded-none border-b border-[#1f2937] bg-transparent p-0 pb-1">
          <TabsTrigger value="transcript" className="rounded-none px-4 py-2">
            Meeting transcript
          </TabsTrigger>
          <TabsTrigger value="prd" className="rounded-none px-4 py-2">
            PRD document
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TeamMemberPicker
            members={members}
            selectedIds={eligibleIds}
            onChange={setEligibleIds}
          />
        </div>

        <TabsContent value="transcript" className="mt-8 space-y-6">
          <div>
            <h2 className="page-heading">Extract tasks from a meeting</h2>
            <p className="mt-1 text-base leading-6 text-[#9ca3af]">
              Paste notes or upload a transcript (.txt, .vtt, .srt). Gemini will extract action items.
            </p>
          </div>

          <Textarea
            className="h-48 border-0 bg-[#111318] font-mono text-[#9ca3af]"
            placeholder="Paste meeting transcript..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />

          <div className="flex flex-wrap gap-3">
            <Button variant="outline" type="button" onClick={() => setText(SAMPLE)}>
              Load sample transcript
            </Button>
            <label className={cn(buttonVariants({ variant: "outline" }), "cursor-pointer")}>
              Upload file
              <input
                type="file"
                accept=".txt,.vtt,.srt,.png,.jpg,.jpeg"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file && canExtract) {
                    await extractFromFile(file, eligibleList);
                    navigate("/review");
                  }
                }}
              />
            </label>
            <Button
              type="button"
              disabled={loading || text.trim().length < 10 || !canExtract}
              onClick={handleExtract}
            >
              {loading ? "Extracting..." : "Extract Tasks"}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="prd" className="mt-8 space-y-6">
          <div>
            <h2 className="page-heading">Extract tasks from a PRD</h2>
            <p className="mt-1 text-base leading-6 text-[#9ca3af]">
              Upload a Product Requirements Document (.pdf, .docx). Tasks, owners, and feature areas are extracted automatically.
            </p>
          </div>

          <label
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#1f2937] bg-[#111318] p-12 transition-colors",
              canExtract
                ? "hover:border-[#2563eb]/60 hover:bg-[#1a1f2e]"
                : "cursor-not-allowed opacity-50"
            )}
          >
            <span className="text-sm text-muted-foreground">Drop PRD file here or click to browse</span>
            <span className="mt-1 text-xs text-muted-foreground/70">.pdf, .docx supported</span>
            <input
              type="file"
              accept=".pdf,.docx"
              className="hidden"
              disabled={!canExtract}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file && canExtract) {
                  await extractFromPrd(file, eligibleList);
                  navigate("/review");
                }
              }}
            />
          </label>
        </TabsContent>
      </Tabs>

      {!canExtract && (
        <p className="text-sm text-warning font-medium">Select at least one team member to extract tasks.</p>
      )}

      {loading && <ExtractionLoadingOverlay message={loadingMsg} />}

      {error && <p className="text-destructive">{error}</p>}
    </div>
  );
}
