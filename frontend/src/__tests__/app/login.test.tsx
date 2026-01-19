import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LoginPage from "@/app/(auth)/login/page";

// Mock the api-client module
jest.mock("@/lib/api-client", () => ({
  api: {
    auth: {
      login: jest.fn(),
      me: jest.fn(),
    },
  },
  setTokens: jest.fn(),
}));

// Mock useToast
const mockToast = jest.fn();
jest.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

// Mock auth store
const mockLogin = jest.fn();
jest.mock("@/stores/auth-store", () => ({
  useAuthStore: () => ({
    login: mockLogin,
  }),
}));

// Get mocked functions for assertions
import { api, setTokens } from "@/lib/api-client";

describe("LoginPage", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("rendering", () => {
    it("should render login form", () => {
      render(<LoginPage />);

      expect(screen.getByRole("heading", { name: /sign in/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
    });

    it("should render description text", () => {
      render(<LoginPage />);

      expect(
        screen.getByText(/enter your credentials to access storesync/i)
      ).toBeInTheDocument();
    });
  });

  describe("form validation", () => {
    it("should show error when username is empty", async () => {
      render(<LoginPage />);

      const submitButton = screen.getByRole("button", { name: /sign in/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/username is required/i)).toBeInTheDocument();
      });
    });

    it("should show error when password is empty", async () => {
      render(<LoginPage />);

      const usernameInput = screen.getByLabelText(/username/i);
      await user.type(usernameInput, "testuser");

      const submitButton = screen.getByRole("button", { name: /sign in/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/password is required/i)).toBeInTheDocument();
      });
    });

    it("should show both errors when both fields are empty", async () => {
      render(<LoginPage />);

      const submitButton = screen.getByRole("button", { name: /sign in/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/username is required/i)).toBeInTheDocument();
        expect(screen.getByText(/password is required/i)).toBeInTheDocument();
      });
    });
  });

  describe("successful login", () => {
    it("should login successfully with valid credentials", async () => {
      const mockUserData = {
        id: 1,
        username: "testuser",
        email: "test@example.com",
        first_name: "Test",
        last_name: "User",
        role: "admin",
        brands: [],
        date_joined: "2024-01-01T00:00:00Z",
      };

      (api.auth.login as jest.Mock).mockResolvedValue({
        data: { access: "access-token", refresh: "refresh-token" },
      });
      (api.auth.me as jest.Mock).mockResolvedValue({ data: mockUserData });

      render(<LoginPage />);

      const usernameInput = screen.getByLabelText(/username/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole("button", { name: /sign in/i });

      await user.type(usernameInput, "testuser");
      await user.type(passwordInput, "password123");
      await user.click(submitButton);

      await waitFor(() => {
        expect(api.auth.login).toHaveBeenCalledWith("testuser", "password123");
      });

      await waitFor(() => {
        expect(setTokens).toHaveBeenCalledWith("access-token", "refresh-token");
      });

      await waitFor(() => {
        expect(api.auth.me).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith(mockUserData);
      });

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: "Welcome back!",
          description: "You have successfully logged in.",
        });
      });
    });

    it("should show loading state during submission", async () => {
      // Make the API call hang to observe loading state
      (api.auth.login as jest.Mock).mockImplementation(
        () => new Promise(() => {})
      );

      render(<LoginPage />);

      const usernameInput = screen.getByLabelText(/username/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole("button", { name: /sign in/i });

      await user.type(usernameInput, "testuser");
      await user.type(passwordInput, "password123");
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /signing in/i })).toBeInTheDocument();
      });

      // Inputs should be disabled during loading
      expect(usernameInput).toBeDisabled();
      expect(passwordInput).toBeDisabled();
    });
  });

  describe("failed login", () => {
    it("should show error toast on login failure", async () => {
      (api.auth.login as jest.Mock).mockRejectedValue({
        response: { data: { detail: "Invalid credentials" } },
      });

      render(<LoginPage />);

      const usernameInput = screen.getByLabelText(/username/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole("button", { name: /sign in/i });

      await user.type(usernameInput, "wronguser");
      await user.type(passwordInput, "wrongpassword");
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          variant: "destructive",
          title: "Login failed",
          description: "Invalid credentials",
        });
      });
    });

    it("should show default error message when no detail provided", async () => {
      (api.auth.login as jest.Mock).mockRejectedValue({
        response: { data: {} },
      });

      render(<LoginPage />);

      const usernameInput = screen.getByLabelText(/username/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole("button", { name: /sign in/i });

      await user.type(usernameInput, "testuser");
      await user.type(passwordInput, "password");
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          variant: "destructive",
          title: "Login failed",
          description: "Invalid username or password",
        });
      });
    });

    it("should re-enable form after failed login", async () => {
      (api.auth.login as jest.Mock).mockRejectedValue({
        response: { data: { detail: "Error" } },
      });

      render(<LoginPage />);

      const usernameInput = screen.getByLabelText(/username/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole("button", { name: /sign in/i });

      await user.type(usernameInput, "testuser");
      await user.type(passwordInput, "password");
      await user.click(submitButton);

      await waitFor(() => {
        expect(usernameInput).not.toBeDisabled();
        expect(passwordInput).not.toBeDisabled();
        expect(screen.getByRole("button", { name: /sign in/i })).not.toBeDisabled();
      });
    });
  });
});
