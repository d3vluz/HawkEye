export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

export interface SessionMember {
    id: string;
    name: string;
    matricula: string | null;
    email: string | null;
    githubUsername: string | null;
    role: "ADMIN" | "EMPLOYEE";
    mustChangePassword: boolean;
}

export function avatarUrl(githubUsername: string): string {
    return `https://github.com/${githubUsername}.png`;
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
    const res = await fetch(`${API_URL}${path}`, { ...init, credentials: "include" });
    if (res.status === 401 && path !== "/api/auth/login" && path !== "/api/auth/change-password") {
        await logout();
    }
    return res;
}

export class InvalidCredentialsError extends Error {
    constructor() {
        super("Matrícula, e-mail ou senha incorretos.");
    }
}

async function errorMessage(res: Response, fallback: string): Promise<string> {
    const data = await res.json().catch(() => null);
    return typeof data?.message === "string" ? data.message : fallback;
}

export function homeFor(member: SessionMember): string {
    if (member.mustChangePassword) return "/trocar-senha";
    return member.role === "ADMIN" ? "/admin" : "/inspecao";
}

export async function login(identifier: string, password: string): Promise<SessionMember> {
    const res = await apiFetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
    });
    if (res.status === 429) throw new Error("Muitas tentativas. Aguarde um minuto e tente novamente.");
    if (res.status === 401) throw new InvalidCredentialsError();
    if (!res.ok) throw new Error("Não foi possível entrar. Tente novamente.");
    return res.json();
}

export async function logout(): Promise<void> {
    await fetch(`${API_URL}/api/auth/logout`, { method: "POST", credentials: "include" }).catch(() => undefined);
    window.location.assign("/");
}

export async function getMe(): Promise<SessionMember> {
    const res = await apiFetch("/api/auth/me", { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch session");
    return res.json();
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<SessionMember> {
    const res = await apiFetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
    });
    if (!res.ok) throw new Error(await errorMessage(res, "Não foi possível trocar a senha."));
    return res.json();
}

export interface PeriodSummary {
    batches: number;
    captures: number;
    approvalRate: number | null;
    defectsPerCapture: number | null;
    belowTarget: number;
}

export interface DashboardMetrics {
    periodDays: number;
    qualityTarget: number;
    totals: { batches: number; captures: number; approvalRate: number | null };
    current: PeriodSummary;
    previous: PeriodSummary;
    series: { date: string; captures: number; approvalRate: number | null; defectsPerCapture: number | null }[];
    defectsByType: { key: string; label: string; captures: number; share: number | null; previousShare: number | null }[];
    units: ({ id: string | null; name: string } & PeriodSummary)[];
    operators: ({ matricula: string; name: string | null } & PeriodSummary)[];
    recentBatches: {
        id: string;
        name: string;
        createdAt: string;
        unit: Unit | null;
        author: BatchAuthor | null;
        captures: number;
        approvalRate: number | null;
        defects: number;
    }[];
}

export interface BatchAuthor {
    matricula: string;
    name: string | null;
}

export interface Batch {
    id: string;
    name: string;
    description: string;
    total_captures: number;
    valid_captures?: number;
    invalid_captures?: number;
    total_defects: number;
    quality_score: number;
    created_at: string;
    author: BatchAuthor | null;
    unit: Unit | null;
}

export interface Capture {
    id: string;
    filename: string;
    sha256?: string;
    is_valid: boolean;
    original_uri: string;
    processed_uri: string;
    processed_areas_uri?: string;
    processed_pins_uri?: string;
    processed_shaft_uri?: string;
    defects_count: number;
    hasMissingPins?: boolean;
    hasExtraPins?: boolean;
    hasDamagedPins?: boolean;
    hasWrongColorPins?: boolean;
    hasStructureDamage?: boolean;
    hasShaftDefects?: boolean;
}

function unitQuery(unitId?: string): string {
    return unitId ? `?unitId=${encodeURIComponent(unitId)}` : "";
}

export async function getDashboardMetrics(unitId?: string): Promise<DashboardMetrics> {
    const res = await apiFetch(`/api/metrics/dashboard${unitQuery(unitId)}`, {
        cache: "no-store",
    });
    if (!res.ok) {
        throw new Error("Failed to fetch dashboard metrics");
    }
    return res.json();
}

export async function getBatches(unitId?: string): Promise<{ batches: Batch[], total: number }> {
    const res = await apiFetch(`/api/batches${unitQuery(unitId)}`, {
        cache: "no-store",
    });
    if (!res.ok) {
        throw new Error("Failed to fetch batches");
    }
    const data = await res.json();
    return { batches: data.batches, total: data.batches.length };
}

export async function getBatchDetails(batchId: string): Promise<{ batch: Batch, captures: Capture[] }> {
    const res = await apiFetch(`/api/batches/${batchId}`, {
        cache: "no-store",
    });
    if (!res.ok) {
        throw new Error("Failed to fetch batch details");
    }
    return res.json();
}

export async function getMyCollections(): Promise<Batch[]> {
    const res = await apiFetch(`/api/batches/mine`, { cache: "no-store" });
    if (!res.ok) throw new Error("Tente novamente em instantes.");
    return (await res.json()).batches;
}

export async function getMyCollectionDetails(batchId: string): Promise<{ batch: Batch, captures: Capture[] }> {
    const res = await apiFetch(`/api/batches/mine/${batchId}`, { cache: "no-store" });
    if (!res.ok) throw new Error(res.status === 404 ? "Coleta não encontrada." : "Tente novamente em instantes.");
    return res.json();
}

export async function deleteBatch(batchId: string): Promise<boolean> {
    const res = await apiFetch(`/api/batches/${batchId}`, {
        method: "DELETE",
    });
    if (!res.ok) {
        throw new Error("Failed to delete batch");
    }
    return true;
}

// ===== Equipe (membros e unidades) =====

export interface Unit {
    id: string;
    name: string;
}

export interface UnitSummary extends Unit {
    memberCount: number;
    batchCount: number;
}

export interface Member {
    id: string;
    name: string;
    matricula: string | null;
    email: string | null;
    phone: string | null;
    githubUsername: string | null;
    role: "ADMIN" | "EMPLOYEE";
    status: "ACTIVE" | "INACTIVE";
    allUnits: boolean;
    lastAccessAt: string | null;
    hasPassword: boolean;
    units: Unit[];
}

export interface TeamOverview {
    members: number;
    activeToday: number;
    units: number;
}

export interface MemberPayload {
    name: string;
    matricula: string;
    phone?: string;
    email?: string;
    temporaryPassword: string;
    allUnits: boolean;
    unitIds: string[];
}

export interface MemberUpdate {
    name: string;
    phone: string | null;
    email: string | null;
}

export async function getTeamOverview(): Promise<TeamOverview> {
    const res = await apiFetch(`/api/team/overview`, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch team overview");
    return res.json();
}

export async function getMembers(): Promise<Member[]> {
    const res = await apiFetch(`/api/members`, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch members");
    return res.json();
}

export async function getUnits(): Promise<UnitSummary[]> {
    const res = await apiFetch(`/api/units`, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch units");
    return res.json();
}

export async function createMember(payload: MemberPayload): Promise<Member> {
    const res = await apiFetch(`/api/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await errorMessage(res, "Não foi possível criar o membro."));
    return res.json();
}

export async function resetMemberPassword(id: string, temporaryPassword: string): Promise<void> {
    const res = await apiFetch(`/api/members/${id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ temporaryPassword }),
    });
    if (!res.ok) throw new Error(await errorMessage(res, "Não foi possível definir a senha."));
}

export async function updateMember(id: string, update: MemberUpdate): Promise<void> {
    const res = await apiFetch(`/api/members/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(update),
    });
    if (!res.ok) throw new Error(await errorMessage(res, "Não foi possível salvar as alterações."));
}

export async function updateMemberRole(id: string, role: Member["role"]): Promise<void> {
    const res = await apiFetch(`/api/members/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
    });
    if (!res.ok) throw new Error(await errorMessage(res, "Não foi possível alterar o perfil."));
}

export async function deleteMember(id: string): Promise<void> {
    const res = await apiFetch(`/api/members/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error(await errorMessage(res, "Não foi possível remover o membro."));
}

export async function getMyUnits(): Promise<Unit[]> {
    const res = await apiFetch(`/api/units/mine`, { cache: "no-store" });
    if (!res.ok) throw new Error("Não foi possível carregar suas linhas.");
    return res.json();
}

async function sendUnit(path: string, method: "POST" | "PATCH", name: string, fallback: string): Promise<void> {
    const res = await apiFetch(path, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error(await errorMessage(res, fallback));
}

export function createUnit(name: string): Promise<void> {
    return sendUnit(`/api/units`, "POST", name, "Não foi possível criar a unidade.");
}

export function renameUnit(id: string, name: string): Promise<void> {
    return sendUnit(`/api/units/${id}`, "PATCH", name, "Não foi possível renomear a unidade.");
}

export async function deleteUnit(id: string): Promise<void> {
    const res = await apiFetch(`/api/units/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error(await errorMessage(res, "Não foi possível remover a unidade."));
}

// ===== Configurações =====

export interface InspectionSettings {
    expectedRows: number | null;
    expectedCols: number | null;
    minQualityScore: number;
    rejectMissingPins: boolean;
    rejectExtraPins: boolean;
    rejectDamagedPins: boolean;
    rejectWrongColorPins: boolean;
    rejectStructureDamage: boolean;
    rejectShaftDefects: boolean;
    updatedAt?: string;
    updatedByMatricula?: string | null;
}

export interface StorageUsage {
    review: { objects: number; bytes: number };
    permanent: { objects: number; bytes: number };
    abandoned: { sessions: number; objects: number; bytes: number };
    abandonedAfterHours: number;
}

export interface ServiceCheck {
    status: "online" | "offline";
    latencyMs: number;
    error?: string;
}

export interface SystemStatus {
    checkedAt: string;
    api: { status: "online"; uptimeSeconds: number };
    database: ServiceCheck;
    storage: ServiceCheck;
    worker: ServiceCheck;
}

export async function getInspectionSettings(): Promise<InspectionSettings> {
    const res = await apiFetch(`/api/settings/inspection`, { cache: "no-store" });
    if (!res.ok) throw new Error("Não foi possível carregar os critérios de inspeção.");
    return res.json();
}

export async function updateInspectionSettings(settings: InspectionSettings): Promise<InspectionSettings> {
    const { updatedAt: _updatedAt, updatedByMatricula: _updatedBy, ...payload } = settings;
    const res = await apiFetch(`/api/settings/inspection`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await errorMessage(res, "Não foi possível salvar os critérios."));
    return res.json();
}

export async function getStorageUsage(): Promise<StorageUsage> {
    const res = await apiFetch(`/api/settings/storage`, { cache: "no-store" });
    if (!res.ok) throw new Error("Não foi possível ler o armazenamento.");
    return res.json();
}

export async function cleanupAbandonedReviews(): Promise<StorageUsage["abandoned"]> {
    const res = await apiFetch(`/api/settings/storage/cleanup`, { method: "POST" });
    if (!res.ok) throw new Error(await errorMessage(res, "Não foi possível limpar as revisões abandonadas."));
    return res.json();
}

export async function getSystemStatus(): Promise<SystemStatus> {
    const res = await apiFetch(`/api/settings/status`, { cache: "no-store" });
    if (!res.ok) throw new Error("Não foi possível verificar o sistema.");
    return res.json();
}
