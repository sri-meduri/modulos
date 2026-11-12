import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { client } from '../lib/amplify';
import { storage } from '../lib/storage';
import { saveErrors } from '../lib/events';

type ModelName = 'Finances' | 'Settings';

// Amplify's generated client types each model's create/update/list signature
// individually, which doesn't unify cleanly with a runtime-selected model
// name + generic T. This narrow cast isolates that at the one boundary where
// it's unavoidable (mirrors the old hook's own `data.data as T` cast).
type GqlErrors = Array<{ message: string }> | undefined;
type GenericModelClient = {
  list: (args?: unknown) => Promise<{ data: Array<Record<string, unknown>>; errors?: GqlErrors }>;
  create: (input: Record<string, unknown>) => Promise<{ data: Record<string, unknown> | null; errors?: GqlErrors }>;
  update: (input: Record<string, unknown>) => Promise<{ data: Record<string, unknown> | null; errors?: GqlErrors }>;
  delete: (input: { id: string }) => Promise<{ data: Record<string, unknown> | null; errors?: GqlErrors }>;
};

/**
 * Amplify Data returns write failures in an `errors` array rather than
 * throwing, so ignoring it makes a rejected save look like success. Surface
 * any errors both to the console and to a global banner listener.
 */
const reportGqlErrors = (op: string, model: string, errors: GqlErrors): boolean => {
  if (!errors?.length) return false;
  const message = errors.map((e) => e.message).join('; ');
  console.error(`${op} ${model} failed:`, message);
  saveErrors.emit(`${model} ${op} failed: ${message}`);
  return true;
};

/** Strips server-managed and meta fields the model's input type won't accept. */
const stripMeta = (value: Record<string, unknown>): Record<string, unknown> => {
  const { id, owner, createdAt, updatedAt, __typename, ...clean } = value;
  return clean;
};

/**
 * Deep-cleans a value into strictly-valid JSON: non-finite numbers
 * (NaN/Infinity) become 0 and `undefined`s are dropped. AppSync rejects
 * AWSJSON fields ("has an invalid value") when either sneaks in, which
 * otherwise silently fails the whole save.
 */
const sanitizeJson = <V>(v: V): V => {
  if (typeof v === 'number') return (Number.isFinite(v) ? v : 0) as V;
  if (Array.isArray(v)) return v.filter((x) => x !== undefined).map(sanitizeJson) as V;
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (val === undefined) continue;
      out[k] = sanitizeJson(val);
    }
    return out as V;
  }
  return v;
};

/** Serializes designated a.json()/AWSJSON fields to strings for writes. */
const encodeJsonFields = (value: Record<string, unknown>, jsonFields: string[]): Record<string, unknown> => {
  if (!jsonFields.length) return value;
  const out = { ...value };
  for (const f of jsonFields) {
    if (f in out && typeof out[f] !== 'string') out[f] = JSON.stringify(out[f]);
  }
  return out;
};

/** Parses designated a.json() fields back to objects on read (guards non-strings). */
const decodeJsonFields = (record: Record<string, unknown>, jsonFields: string[]): Record<string, unknown> => {
  if (!jsonFields.length) return record;
  const out = { ...record };
  for (const f of jsonFields) {
    if (typeof out[f] === 'string') {
      try { out[f] = JSON.parse(out[f] as string); } catch { /* leave as-is */ }
    }
  }
  return out;
};

function useAmplifyStorage<T extends object>(
  key: string,
  initialValue: T,
  modelName: ModelName,
  jsonFields: string[] = []
): [T, React.Dispatch<React.SetStateAction<T>>, boolean, () => Promise<void>] {
  const { user, isGuest, isSample } = useAuth();
  const model = client.models[modelName] as unknown as GenericModelClient;

  const getStorageKey = useCallback((userId?: string | null, guest?: boolean) => {
    if (isSample) return `sample_${key}`;
    if (guest ?? isGuest) return `guest_${key}`;
    if (userId ?? user?.userId) return `user_${userId ?? user?.userId}_${key}`;
    return key;
  }, [user?.userId, isGuest, isSample, key]);

  const readLocalStorage = useCallback((userId?: string | null, guest?: boolean): T | null => {
    try {
      return storage.getJson<T>(getStorageKey(userId, guest));
    } catch {
      return null;
    }
  }, [getStorageKey]);

  const [storedValue, setStoredValue] = useState<T>(() => readLocalStorage() ?? initialValue);
  const [loading, setLoading] = useState(!!user && !isGuest);
  const lastLoadedUserIdRef = useRef<string | null | undefined>(undefined);
  const recordIdRef = useRef<string | null>(null);

  const loadFromDatabase = useCallback(async (userId: string) => {
    try {
      const { data: records, errors } = await model.list();
      reportGqlErrors('load', modelName, errors);
      const record = records[0];
      if (record) {
        recordIdRef.current = record.id as string;
        const value = decodeJsonFields(stripMeta(record), jsonFields) as unknown as T;
        setStoredValue(value);
        storage.setJson(getStorageKey(userId, false), value);
      } else {
        recordIdRef.current = null;
      }
    } catch (error) {
      console.error(`Error loading ${modelName} from Amplify Data:`, error);
    } finally {
      setLoading(false);
    }
  }, [modelName, getStorageKey]);

  useEffect(() => {
    if (lastLoadedUserIdRef.current === user?.userId) return;
    lastLoadedUserIdRef.current = user?.userId;

    if (!user || isGuest) {
      const cached = readLocalStorage(user?.userId, isGuest);
      if (cached !== null) setStoredValue(cached);
      setLoading(false);
      return;
    }

    const cached = readLocalStorage(user.userId, false);
    if (cached !== null) {
      setStoredValue(cached);
      setLoading(false);
      loadFromDatabase(user.userId);
    } else {
      setLoading(true);
      loadFromDatabase(user.userId);
    }
  }, [user?.userId, isGuest]);

  const saveToDatabase = useCallback(async (value: T) => {
    storage.setJson(getStorageKey(), value);

    if (!user || isGuest) return;

    try {
      const clean = encodeJsonFields(
        sanitizeJson(stripMeta(value as unknown as Record<string, unknown>)),
        jsonFields
      );
      if (recordIdRef.current) {
        const { errors } = await model.update({ id: recordIdRef.current, ...clean });
        reportGqlErrors('update', modelName, errors);
      } else {
        const { data: created, errors } = await model.create({ ...clean });
        if (reportGqlErrors('create', modelName, errors)) return;
        if (created) recordIdRef.current = created.id as string;
      }
    } catch (error) {
      console.error(`Error saving ${modelName} to Amplify Data:`, error);
    }
  }, [user?.userId, isGuest, modelName, getStorageKey]);

  const setValue: React.Dispatch<React.SetStateAction<T>> = useCallback((value) => {
    setStoredValue(prevValue => {
      const valueToStore = value instanceof Function ? value(prevValue) : value;
      saveToDatabase(valueToStore);
      return valueToStore;
    });
  }, [saveToDatabase]);

  const deleteRemote = useCallback(async (): Promise<void> => {
    if (!user || isGuest || !recordIdRef.current) return;
    try {
      await model.delete({ id: recordIdRef.current });
      recordIdRef.current = null;
    } catch (error) {
      console.error(`Error deleting ${modelName} from Amplify Data:`, error);
    }
  }, [user?.userId, isGuest, modelName]);

  return [storedValue, setValue, loading, deleteRemote];
}

export default useAmplifyStorage;
