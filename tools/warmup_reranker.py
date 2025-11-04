from importlib import import_module
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1] / "apps" / "api"
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def main() -> None:
    module = import_module("app.services.reranker")
    loader = getattr(module, "_load_ce", None)
    if loader is None:
        print("[WARMUP] _load_ce not found in services.reranker")
        return

    print("[WARMUP] Loading CrossEncoder ...")
    ce = loader()
    if ce is None:
        print("[WARMUP] CrossEncoder load returned None")
        return

    model_id_fn = getattr(module, "ce_model_id", lambda: None)
    model_id = model_id_fn()
    print(f"[WARMUP] CrossEncoder loaded: {model_id or type(ce)}")
if __name__ == "__main__":
    main()
