import { act, renderHook } from "@testing-library/react";
import { useAuthStore } from "@/stores/auth-store";

describe("useAuthStore", () => {
  beforeEach(() => {
    // Reset store state before each test
    const { result } = renderHook(() => useAuthStore());
    act(() => {
      result.current.logout();
    });
  });

  describe("initial state", () => {
    it("should have null user initially", () => {
      const { result } = renderHook(() => useAuthStore());
      expect(result.current.user).toBeNull();
    });

    it("should not be authenticated initially", () => {
      const { result } = renderHook(() => useAuthStore());
      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  describe("login", () => {
    it("should set user and authenticate on login", () => {
      const { result } = renderHook(() => useAuthStore());
      const mockUser = {
        id: 1,
        username: "testuser",
        email: "test@example.com",
        first_name: "Test",
        last_name: "User",
        role: "admin" as const,
        brands: ["brand-1"],
        date_joined: "2024-01-01T00:00:00Z",
      };

      act(() => {
        result.current.login(mockUser);
      });

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("logout", () => {
    it("should clear user and authentication on logout", () => {
      const { result } = renderHook(() => useAuthStore());
      const mockUser = {
        id: 1,
        username: "testuser",
        email: "test@example.com",
        first_name: "Test",
        last_name: "User",
        role: "admin" as const,
        brands: ["brand-1"],
        date_joined: "2024-01-01T00:00:00Z",
      };

      act(() => {
        result.current.login(mockUser);
      });

      expect(result.current.isAuthenticated).toBe(true);

      act(() => {
        result.current.logout();
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("setUser", () => {
    it("should set user and update authentication state", () => {
      const { result } = renderHook(() => useAuthStore());
      const mockUser = {
        id: 1,
        username: "testuser",
        email: "test@example.com",
        first_name: "Test",
        last_name: "User",
        role: "viewer" as const,
        brands: [],
        date_joined: "2024-01-01T00:00:00Z",
      };

      act(() => {
        result.current.setUser(mockUser);
      });

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isAuthenticated).toBe(true);
    });

    it("should set isAuthenticated to false when user is null", () => {
      const { result } = renderHook(() => useAuthStore());
      const mockUser = {
        id: 1,
        username: "testuser",
        email: "test@example.com",
        first_name: "Test",
        last_name: "User",
        role: "viewer" as const,
        brands: [],
        date_joined: "2024-01-01T00:00:00Z",
      };

      act(() => {
        result.current.setUser(mockUser);
      });

      expect(result.current.isAuthenticated).toBe(true);

      act(() => {
        result.current.setUser(null);
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  describe("setLoading", () => {
    it("should update loading state", () => {
      const { result } = renderHook(() => useAuthStore());

      act(() => {
        result.current.setLoading(true);
      });

      expect(result.current.isLoading).toBe(true);

      act(() => {
        result.current.setLoading(false);
      });

      expect(result.current.isLoading).toBe(false);
    });
  });
});
