import sys
import types
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

# Unit tests use a fake database and do not require the optional Supabase SDK.
if 'supabase' not in sys.modules:
    module = types.ModuleType('supabase')
    module.Client = object
    module.create_client = lambda *_args, **_kwargs: None
    sys.modules['supabase'] = module
