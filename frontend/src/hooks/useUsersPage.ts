import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { api, errorMessage } from "../api/client";
import { useToast } from "../components/Toast";
import { useMounted, useReadRequest } from "./useReadRequest";
import { useFormErrors } from "./useFormErrors";
import type { Paginated, User } from "../types";
export function useUsersPage() {
  const validation = useFormErrors();
  const [q, setQ] = useState("");
  const [applied, setApplied] = useState({ q: "", page: 1 });
  const latest = useRef(applied);
  latest.current = applied;
  const [form, setForm] = useState({ email: "", full_name: "", password: "" });
  const [creating, setCreating] = useState(false);
  const [pending, setPending] = useState<number[]>([]);
  const [createError, setCreateError] = useState("");
  const createLock = useRef(false);
  const toggleLocks = useRef(new Set<number>());
  const submitted = useRef("");
  const mounted = useMounted();
  const toast = useToast();
  const { data, loading, error, run } = useReadRequest<Paginated<User>>();
  const load = useCallback(
    (page = 1, query = applied.q) => {
      setApplied({ q: query, page });
      return run(
        async (signal) =>
          (
            await api.get<Paginated<User>>("/api/users", {
              signal,
              params: { page, page_size: 8, q: query || undefined },
            })
          ).data,
      );
    },
    [applied.q, run],
  );
  useEffect(() => {
    void run(
      async (signal) =>
        (
          await api.get<Paginated<User>>("/api/users", {
            signal,
            params: { page: 1, page_size: 8, q: undefined },
          })
        ).data,
    );
  }, [run]);
  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (createLock.current) return;
    createLock.current = true;
    setCreating(true);
    setCreateError("");
    try {
      await api.post("/api/users", { ...form, role: "OFFICER" });
      if (mounted.current) {
        toast.success("Đã tạo người dùng");
        setForm({ email: "", full_name: "", password: "" });
        void load(1, latest.current.q);
      }
    } catch (err) {
      if (mounted.current) setCreateError(errorMessage(err));
    } finally {
      createLock.current = false;
      if (mounted.current) setCreating(false);
    }
  }
  async function toggle(user: User) {
    if (user.role !== "OFFICER" || toggleLocks.current.has(user.id)) return;
    toggleLocks.current.add(user.id);
    setPending((previous) => [...previous, user.id]);
    try {
      await api.put(`/api/users/${user.id}`, { is_active: !user.is_active });
      if (mounted.current) {
        toast.success(
          user.is_active ? "Đã khóa tài khoản" : "Đã mở khóa tài khoản",
        );
        void load(latest.current.page, latest.current.q);
      }
    } catch (err) {
      if (mounted.current) toast.error(errorMessage(err));
    } finally {
      toggleLocks.current.delete(user.id);
      if (mounted.current)
        setPending((previous) => previous.filter((id) => id !== user.id));
    }
  }
  return {
    validation,
    q,
    setQ,
    applied,
    form,
    setForm,
    creating,
    pending,
    createError,
    submitted,
    data,
    loading,
    error,
    load,
    onSubmit,
    toggle,
  };
}
