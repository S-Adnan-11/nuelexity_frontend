import { Link } from "react-router";
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
  const chosen = catalogue?.models.find((model) => model.id === selectedId);
  const unavailable = catalogue?.answerMode === "ai" && (!chosen || !chosen.available);
  return (
    <div className="model-control">
      <div className="model-control-row">
        <label htmlFor="chat-model">Model</label>
        <select id="chat-model" value={selectedId || ""} aria-describedby="model-hint model-status"
          disabled={!signedIn || !catalogue?.canSelect || catalogue.answerMode !== "ai" || loading || disabled}
          onChange={(event) => onChange(event.target.value)}>
          {!catalogue && <option value="">{loading ? "Loading models…" : "Models unavailable"}</option>}
          {catalogue && selectedId && !chosen && <option value={selectedId} disabled>{selectedId} · Unavailable</option>}
          {catalogue?.models.map((model) => (
            <option key={model.id} value={model.id} disabled={!model.available}>
              {model.name}{model.preview ? " · Preview" : ""}{model.id === catalogue.defaultModelId ? " · Default" : ""}{!model.available ? " · Unavailable" : ""}
            </option>
          ))}
        </select>
        {catalogue?.answerMode === "ai" && <span className="model-provider"></span>}
      </div>
      <p id="model-hint" className="model-hint">
        {!signedIn ? <><Link to="/auth">Sign in</Link> to access more models.</> :
          catalogue?.answerMode === "sources-only" ? "AI answers are not enabled. Searches return sources only." :
          "Qwen is in Preview; its availability can change."}
      </p>
      <div id="model-status" role={error || unavailable ? "alert" : "status"} className="model-hint">
        {saving && "Saving model choice…"}
        {error || (unavailable ? signedIn ? "Your selected model is unavailable. Choose an available model." : "The default model is unavailable. Refresh models before trying again." : "")}
        {(error || unavailable) && <button type="button" className="model-refresh" onClick={onRefresh} disabled={loading}>{refreshLabel}</button>}
      </div>
    </div>
  );
}
