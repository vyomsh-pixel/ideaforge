export type CustomFetchOptions = RequestInit & {
  responseType?: "json" | "text" | "blob" | "auto";
};

export type ErrorType<T = unknown> = ApiError<T>;
export type BodyType<T> = T;
export type AuthTokenGetter = () => Promise<string | null> | string | null;

let _baseUrl: string | null = null;
let _authTokenGetter: AuthTokenGetter | null = null;

export function setBaseUrl(url: string | null): void {
  _baseUrl = url ? url.replace(/\/+$/, "") : null;
}

export function setAuthTokenGetter(getter: AuthTokenGetter | null): void {
  _authTokenGetter = getter;
}

export class ApiError<T = unknown> extends Error {
  readonly name = "ApiError";
  readonly status: number;
  readonly statusText: string;
  readonly data: T | null;
  readonly headers: Headers;
  readonly response: Response;
  readonly method: string;
  readonly url: string;

  constructor(
    response: Response,
    data: T | null,
    requestInfo: { method: string; url: string },
  ) {
    const msg =
      data && typeof data === "object" && "error" in data && typeof (data as { error?: unknown }).error === "string"
        ? (data as { error: string }).error
        : `HTTP ${response.status} ${response.statusText}`;
    super(msg);
    Object.setPrototypeOf(this, new.target.prototype);
    this.status = response.status;
    this.statusText = response.statusText;
    this.data = data;
    this.headers = response.headers;
    this.response = response;
    this.method = requestInfo.method;
    this.url = response.url || requestInfo.url;
  }
}

function getStoredBearerToken(): string | null {
  try {
    if (typeof localStorage !== "undefined") {
      return localStorage.getItem("ideaforge_token");
    }
  } catch {
    // Ignore storage access errors in non-browser or restricted environments
  }
  return null;
}

export async function customFetch<T = unknown>(
  input: RequestInfo | URL,
  options: CustomFetchOptions = {},
): Promise<T> {
  const { responseType = "auto", headers: headersInit, ...init } = options;
  const method = (init.method ?? "GET").toUpperCase();

  let url = typeof input === "string" ? input : input.toString();
  if (_baseUrl && url.startsWith("/")) {
    url = `${_baseUrl}${url}`;
  }

  const headers = new Headers(headersInit);
  if (typeof init.body === "string" && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  if (!headers.has("authorization")) {
    const token = _authTokenGetter
      ? await _authTokenGetter()
      : getStoredBearerToken();
    if (token) {
      headers.set("authorization", `Bearer ${token}`);
    }
  }

  const response = await fetch(url, { ...init, method, headers });
  const requestInfo = { method, url };

  if (response.status === 204 || response.status === 205 || method === "HEAD") {
    if (!response.ok) {
      throw new ApiError(response, null, requestInfo);
    }
    return null as T;
  }

  if (!response.ok) {
    let errorData: unknown = null;
    try {
      const text = await response.text();
      errorData = text ? JSON.parse(text) : null;
    } catch {
      errorData = null;
    }
    throw new ApiError(response, errorData, requestInfo);
  }

  if (responseType === "blob") {
    return (await response.blob()) as T;
  }
  if (responseType === "text") {
    return (await response.text()) as T;
  }

  const text = await response.text();
  if (!text.trim()) return null as T;
  return JSON.parse(text) as T;
}
