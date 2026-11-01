export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

export interface DashboardMetrics {
    totalBatches: number;
    totalImages: number;
    validImages: number;
    totalDefects: number;
    successRate: number;
    qualityScore: number;
    recentBatches: { id: string, name: string, totalCaptures: number, validCaptures: number, qualityScore: number, defectCount: number }[];
    defectsRanking: { rank: number, code: string, label: string, count: number, severity: number, percentage: number }[];
    dailyStats: { date: string, volume: number, valid: number, defects: number }[];
    topDefects: { rank: number, code: string, label: string, count: number, severity: number, percentage: number }[];
    defectTrends: { name: string, count: number, date: string }[];
    errorDistribution: { name: string, value: number }[];
    validityDistribution: { name: string, value: number, color: string }[];
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

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
    const res = await fetch(`${API_URL}/api/metrics/dashboard`, {
        cache: "no-store",
    });
    if (!res.ok) {
        throw new Error("Failed to fetch dashboard metrics");
    }
    return res.json();
}

export async function getBatches(): Promise<{ batches: Batch[], total: number }> {
    const res = await fetch(`${API_URL}/api/batches`, {
        cache: "no-store",
    });
    if (!res.ok) {
        throw new Error("Failed to fetch batches");
    }
    const data = await res.json();
    return { batches: data.batches, total: data.batches.length };
}

export async function getBatchDetails(batchId: string): Promise<{ batch: Batch, captures: Capture[] }> {
    const res = await fetch(`${API_URL}/api/batches/${batchId}`, {
        cache: "no-store",
    });
    if (!res.ok) {
        throw new Error("Failed to fetch batch details");
    }
    return res.json();
}

export async function deleteBatch(batchId: string): Promise<boolean> {
    const res = await fetch(`${API_URL}/api/batches/${batchId}`, {
        method: "DELETE",
    });
    if (!res.ok) {
        throw new Error("Failed to delete batch");
    }
    return true;
}

// ===== Equipe (membros, convites, unidades) =====

export interface Unit {
    id: string;
    name: string;
}

export interface Member {
    id: string;
    name: string;
    email: string;
    status: "ACTIVE" | "INACTIVE";
    allUnits: boolean;
    lastAccessAt: string | null;
    units: Unit[];
}

export interface Invite {
    id: string;
    name: string | null;
    email: string;
    status: "PENDING" | "ACCEPTED" | "CANCELLED";
    allUnits: boolean;
    createdAt: string;
    units: Unit[];
}

export interface TeamOverview {
    members: number;
    activeToday: number;
    pendingInvites: number;
    units: number;
}

export interface TeamMemberPayload {
    name?: string;
    email: string;
    allUnits: boolean;
    unitIds: string[];
}

export async function getTeamOverview(): Promise<TeamOverview> {
    const res = await fetch(`${API_URL}/api/team/overview`, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch team overview");
    return res.json();
}

export async function getMembers(): Promise<Member[]> {
    const res = await fetch(`${API_URL}/api/members`, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch members");
    return res.json();
}

export async function getInvites(): Promise<Invite[]> {
    const res = await fetch(`${API_URL}/api/invites`, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch invites");
    return res.json();
}

export async function getUnits(): Promise<Unit[]> {
    const res = await fetch(`${API_URL}/api/units`, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch units");
    return res.json();
}

export async function createInvite(payload: TeamMemberPayload): Promise<Invite> {
    const res = await fetch(`${API_URL}/api/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to create invite");
    return res.json();
}

export async function createMember(payload: TeamMemberPayload): Promise<Member> {
    const res = await fetch(`${API_URL}/api/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to create member");
    return res.json();
}

export async function acceptInvite(id: string): Promise<void> {
    const res = await fetch(`${API_URL}/api/invites/${id}/accept`, { method: "POST" });
    if (!res.ok) throw new Error("Failed to accept invite");
}

export async function resendInvite(id: string): Promise<void> {
    const res = await fetch(`${API_URL}/api/invites/${id}/resend`, { method: "POST" });
    if (!res.ok) throw new Error("Failed to resend invite");
}

export async function cancelInvite(id: string): Promise<void> {
    const res = await fetch(`${API_URL}/api/invites/${id}/cancel`, { method: "POST" });
    if (!res.ok) throw new Error("Failed to cancel invite");
}

export async function deleteMember(id: string): Promise<void> {
    const res = await fetch(`${API_URL}/api/members/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to delete member");
}
