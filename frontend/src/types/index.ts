export type MaterialType = "book" | "magazine" | "other";
export type CopyStatus = "available" | "issued" | "lost" | "damaged" | "withdrawn";
export type UserRole = "admin" | "staff";

export interface Series {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  material_type: MaterialType;
  next_serial: number;
  is_active: boolean;
  book_count: number;
  sub_series_count: number;
}

export interface SubSeries {
  id: number;
  series_id: number;
  series_code: string;
  series_name: string;
  name: string;
  description?: string | null;
  is_active: boolean;
  book_count: number;
}

export type BookOrderBy = "series" | "latest";

export interface BookCopy {
  id: number;
  copy_number: number;
  status: CopyStatus;
  acquired_date?: string | null;
  remarks?: string | null;
  display_serial: string;
  created_at?: string | null;
}

export interface Book {
  id: number;
  series_id: number;
  series_code: string;
  series_name: string;
  sub_series_id?: number | null;
  sub_series_name?: string | null;
  base_serial: number;
  title: string;
  author: string;
  language?: string | null;
  publisher?: string | null;
  year_published?: number | null;
  isbn?: string | null;
  notes?: string | null;
  created_at: string;
  copies: BookCopy[];
  total_copies: number;
  display_serial: string;
  latest_activity?: string | null;
}

export interface PaginatedBooks {
  total: number;
  page: number;
  page_size: number;
  items: Book[];
}

export interface ExactMatch {
  book_id: number;
  display_serial: string;
  title: string;
  author: string;
  series_id: number;
  series_code: string;
  series_name: string;
  sub_series_id?: number | null;
  sub_series_name?: string | null;
}

export interface CategorySuggestion {
  series_id: number;
  series_code: string;
  series_name: string;
  sub_series_id?: number | null;
  sub_series_name?: string | null;
  confidence: number;
  reason: string;
}

export interface CategorySuggestionResponse {
  exact_match?: ExactMatch | null;
  suggestions: CategorySuggestion[];
  similar_titles: ExactMatch[];
  ml_active: boolean;
  trained_on_books: number;
  recommend_new_category: boolean;
}

export interface ModelStatus {
  sklearn_available: boolean;
  active: boolean;
  trained_on_books: number;
  classes: number;
  total_books: number;
  min_books_required: number;
}

export interface MagazineIssue {
  id: number;
  issue_number?: string | null;
  issue_period?: string | null;
  received_date?: string | null;
  status: CopyStatus;
  remarks?: string | null;
}

export interface Magazine {
  id: number;
  series_id: number;
  series_code: string;
  base_serial: number;
  title: string;
  month?: string | null;
  publisher?: string | null;
  language?: string | null;
  frequency?: string | null;
  notes?: string | null;
  display_serial: string;
  issues: MagazineIssue[];
  issue_count: number;
}

export interface DashboardStats {
  total_books: number;
  total_series: number;
  total_sub_series: number;
  total_taranga: number;
  added_this_month: number;
  recent_additions: Book[];
}

export interface AuthUser {
  username: string;
  role: UserRole;
}
