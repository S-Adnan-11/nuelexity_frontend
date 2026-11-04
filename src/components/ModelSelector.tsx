import { useNavigate } from "react-router";
import { LockKeyhole, ChevronDown, Check } from "lucide-react";
import * as Select from "@radix-ui/react-select";
import type { ModelCatalogue } from "@/lib/types";

export function ModelSelector({ catalogue, selectedId, signedIn, loading, saving, error, disabled, onChange, onRefresh, refreshLabel = "Refresh models" }: {
  catalogue: ModelCatalogue | null;
  selectedId: string | null;
  signedIn: boolean;
  loading: boolean;
  saving: boolean;
  error: string | null;
  disabled: boolean;
  onChange: (id: string) => void;
  onRefresh: () => void;
  refreshLabel?: string;
}) {
  const navigate = useNavigate();
  const chosen = catalogue?.models.find(model => model.id === selectedId);
  const canChoose = signedIn && catalogue?.canSelect === true;
  const unavailable = catalogue?.answerMode === "ai" && (!chosen || !chosen.available);
  const status = error || (saving ? "Saving model choice…" : unavailable ?
    signedIn ? "Your selected model is unavailable. Choose an available model." : "The guest default is unavailable. Try refreshing models." : "");
  return <Select.Root value={selectedId ?? ""} onValueChange={id => {
    if (id === "sign-in") { navigate("/auth"); return; }
    if (canChoose && catalogue?.models.some(model => model.id === id && model.available)) onChange(id);
  }}>
    <Select.Trigger id="chat-model" value={selectedId ?? ""} data-can-select={canChoose} className="model-trigger" aria-label="Choose a model"
      aria-describedby={status ? "model-status" : undefined} disabled={disabled || loading || !catalogue}>
      <Select.Value>{catalogue?.answerMode === "sources-only" ? "Sources only" : chosen?.name ?? selectedId ?? (loading ? "Loading models…" : "Models unavailable")}</Select.Value>
      {chosen?.preview && <span className="preview-badge">Preview</span>}
      <Select.Icon><ChevronDown size={14} /></Select.Icon>
    </Select.Trigger>
    <Select.Portal>
      <Select.Content className="model-menu" position="popper" side="top" align="end" sideOffset={10} collisionPadding={12}>
        <Select.ScrollUpButton className="menu-scroll">↑</Select.ScrollUpButton>
        <Select.Viewport>
          <Select.Group>
            <Select.Label className="model-menu-label">Choose a model</Select.Label>
            {catalogue?.models.map(model => {
              const locked = !canChoose && model.id !== catalogue.defaultModelId;
              const restricted = locked || !model.available || catalogue.answerMode !== "ai";
              const description = !model.available ? (model.unavailableReason || "Currently unavailable") :
                locked ? "Sign in required" : !canChoose ? "Default" : "";
              return <Select.Item key={model.id} value={model.id} className="model-option"
                aria-disabled={restricted} aria-label={`${model.name}${model.preview ? ', Preview' : ''}${description ? ', ' + description : ''}`}
                data-locked={locked || undefined} data-unavailable={!model.available || undefined}
                // Keep restricted entries keyboard discoverable, while preventing activation.
                onPointerUp={event => { if (restricted) event.preventDefault(); }}
                onClick={event => { if (restricted) event.preventDefault(); }}
                onKeyDown={event => { if (restricted && ["Enter", " "].includes(event.key)) event.preventDefault(); }}>
                <span className="model-option-copy"><Select.ItemText>{model.name}</Select.ItemText>
                  <span className="model-option-description">{description}</span></span>
                {model.preview && <span className="preview-badge">Preview</span>}
                {locked ? <LockKeyhole size={15} aria-hidden="true" /> : <Select.ItemIndicator><Check size={15} /></Select.ItemIndicator>}
              </Select.Item>;
            })}
          </Select.Group>
          {!canChoose && <><Select.Separator className="model-menu-divider" />
            <Select.Item value="sign-in" className="model-option model-sign-in"><Select.ItemText>Sign in to access more models</Select.ItemText></Select.Item>
          </>}
        </Select.Viewport>
        <Select.ScrollDownButton className="menu-scroll">↓</Select.ScrollDownButton>
      </Select.Content>
    </Select.Portal>
    {status && <p id="model-status" role={error || unavailable ? "alert" : "status"} className="model-status">
      {status} {(error || unavailable) && <button type="button" className="model-refresh" onClick={onRefresh} disabled={loading}>{refreshLabel}</button>}
    </p>}
  </Select.Root>;
}
