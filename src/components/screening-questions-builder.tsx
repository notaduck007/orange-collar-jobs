import { GripVertical, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export type QuestionType = "yes_no" | "single" | "multi" | "number" | "text";

export type ScreeningQuestionDraft = {
  id?: string;
  prompt: string;
  type: QuestionType;
  options: string[];
  required: boolean;
  knockout_answer: unknown | null;
  sort_order: number;
};

const TYPE_LABELS: Record<QuestionType, string> = {
  yes_no: "Yes / No",
  single: "Single choice",
  multi: "Multiple choice",
  number: "Number",
  text: "Short text",
};

export function newQuestion(sort_order = 0): ScreeningQuestionDraft {
  return {
    prompt: "",
    type: "yes_no",
    options: [],
    required: true,
    knockout_answer: null,
    sort_order,
  };
}

export const SCREENING_PRESETS: { label: string; q: Omit<ScreeningQuestionDraft, "sort_order"> }[] = [
  {
    label: "Forklift certified?",
    q: { prompt: "Are you currently forklift certified?", type: "yes_no", options: [], required: true, knockout_answer: false },
  },
  {
    label: "Available overnight?",
    q: { prompt: "Are you available to work overnight shifts?", type: "yes_no", options: [], required: true, knockout_answer: false },
  },
  {
    label: "Can lift 50 lbs?",
    q: { prompt: "Can you repeatedly lift up to 50 lbs?", type: "yes_no", options: [], required: true, knockout_answer: false },
  },
  {
    label: "Stand 8+ hours?",
    q: { prompt: "Can you stand and walk for 8+ hours per shift?", type: "yes_no", options: [], required: true, knockout_answer: false },
  },
  {
    label: "Reliable transportation?",
    q: { prompt: "Do you have reliable transportation to the warehouse?", type: "yes_no", options: [], required: true, knockout_answer: false },
  },
  {
    label: "Pass drug screen?",
    q: { prompt: "Are you able to pass a pre-employment drug screen?", type: "yes_no", options: [], required: true, knockout_answer: false },
  },
  {
    label: "Years of warehouse experience",
    q: { prompt: "How many years of warehouse experience do you have?", type: "number", options: [], required: false, knockout_answer: null },
  },
  {
    label: "Earliest start date",
    q: { prompt: "What is your earliest possible start date?", type: "text", options: [], required: false, knockout_answer: null },
  },
];

interface Props {
  value: ScreeningQuestionDraft[];
  onChange: (next: ScreeningQuestionDraft[]) => void;
}

export function ScreeningQuestionsBuilder({ value, onChange }: Props) {
  const update = (i: number, patch: Partial<ScreeningQuestionDraft>) => {
    const next = value.slice();
    next[i] = { ...next[i], ...patch };
    onChange(next);
  };
  const remove = (i: number) =>
    onChange(value.filter((_, idx) => idx !== i).map((q, idx) => ({ ...q, sort_order: idx })));
  const add = () => onChange([...value, newQuestion(value.length)]);

  return (
    <div className="space-y-3">
      {value.length === 0 && (
        <p className="rounded-md border border-dashed border-border bg-background p-4 text-center text-sm text-muted-foreground">
          No screening questions yet. Add up to a few short questions to qualify applicants quickly.
        </p>
      )}
      {value.map((q, i) => (
        <div key={i} className="rounded-lg border border-border bg-background p-3 space-y-3">
          <div className="flex items-start gap-2">
            <GripVertical className="mt-2 h-4 w-4 text-muted-foreground" />
            <div className="flex-1 space-y-2">
              <div className="grid gap-2 sm:grid-cols-[1fr_180px]">
                <div>
                  <Label className="text-xs">Question</Label>
                  <Input
                    value={q.prompt}
                    maxLength={300}
                    placeholder="e.g. Can you lift 50 lbs?"
                    onChange={(e) => update(i, { prompt: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Type</Label>
                  <Select
                    value={q.type}
                    onValueChange={(v) => {
                      const t = v as QuestionType;
                      update(i, {
                        type: t,
                        options: t === "single" || t === "multi" ? q.options.length ? q.options : ["", ""] : [],
                        knockout_answer: null,
                      });
                    }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(TYPE_LABELS) as QuestionType[]).map((t) => (
                        <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {(q.type === "single" || q.type === "multi") && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Options</Label>
                  {q.options.map((opt, oi) => (
                    <div key={oi} className="flex gap-2">
                      <Input
                        value={opt}
                        maxLength={120}
                        placeholder={`Option ${oi + 1}`}
                        onChange={(e) => {
                          const opts = q.options.slice();
                          opts[oi] = e.target.value;
                          update(i, { options: opts });
                        }}
                      />
                      <Button
                        type="button" size="icon" variant="ghost"
                        onClick={() => update(i, { options: q.options.filter((_, x) => x !== oi) })}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button" size="sm" variant="outline"
                    onClick={() => update(i, { options: [...q.options, ""] })}
                  >
                    <Plus className="mr-1 h-3 w-3" /> Add option
                  </Button>
                </div>
              )}

              <div className="grid gap-2 sm:grid-cols-2">
                <label className="flex items-center gap-2 text-xs">
                  <Checkbox
                    checked={q.required}
                    onCheckedChange={(c) => update(i, { required: !!c })}
                  />
                  <span>Required</span>
                </label>

                {q.type === "yes_no" && (
                  <div>
                    <Label className="text-xs">Knockout answer (auto-flag)</Label>
                    <Select
                      value={
                        q.knockout_answer === true ? "yes" :
                        q.knockout_answer === false ? "no" : "none"
                      }
                      onValueChange={(v) =>
                        update(i, { knockout_answer: v === "none" ? null : v === "yes" })
                      }
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No knockout</SelectItem>
                        <SelectItem value="yes">Flag if Yes</SelectItem>
                        <SelectItem value="no">Flag if No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {q.type === "single" && q.options.filter(Boolean).length > 0 && (
                  <div>
                    <Label className="text-xs">Knockout answer (auto-flag)</Label>
                    <Select
                      value={typeof q.knockout_answer === "string" ? q.knockout_answer : "none"}
                      onValueChange={(v) => update(i, { knockout_answer: v === "none" ? null : v })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No knockout</SelectItem>
                        {q.options.filter(Boolean).map((o) => (
                          <SelectItem key={o} value={o}>Flag if "{o}"</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>
            <Button type="button" size="icon" variant="ghost" onClick={() => remove(i)}>
              <Trash2 className="h-4 w-4 text-rose-600" />
            </Button>
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" onClick={add} className="w-full">
        <Plus className="mr-1 h-4 w-4" /> Add screening question
      </Button>
    </div>
  );
}

/** Returns true if the given answer matches the question's knockout. */
export function isKnockout(
  question: { type: QuestionType; knockout_answer: unknown | null },
  answer: unknown,
): boolean {
  if (question.knockout_answer === null || question.knockout_answer === undefined) return false;
  if (answer === null || answer === undefined) return false;
  if (question.type === "yes_no") {
    return Boolean(answer) === Boolean(question.knockout_answer);
  }
  if (question.type === "single") {
    return answer === question.knockout_answer;
  }
  if (question.type === "multi" && Array.isArray(answer) && Array.isArray(question.knockout_answer)) {
    return (question.knockout_answer as string[]).every((v) => (answer as string[]).includes(v));
  }
  return false;
}
