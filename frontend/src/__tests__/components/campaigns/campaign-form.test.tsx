import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CampaignForm } from "@/components/campaigns/campaign-form";

// Mock hooks
const mockCreateCampaign = {
  mutateAsync: jest.fn(),
  isPending: false,
};
const mockUpdateCampaign = {
  mutateAsync: jest.fn(),
  isPending: false,
};

jest.mock("@/hooks/use-campaigns", () => ({
  useCreateCampaign: () => mockCreateCampaign,
  useUpdateCampaign: () => mockUpdateCampaign,
}));

const mockBrands = {
  results: [
    { id: "brand-1", name: "Brand One", slug: "brand-one" },
    { id: "brand-2", name: "Brand Two", slug: "brand-two" },
  ],
};

const mockLocations = {
  results: [
    {
      id: "loc-1",
      name: "Downtown Store",
      store_number: "001",
      brand: "brand-1",
    },
    {
      id: "loc-2",
      name: "Mall Store",
      store_number: "002",
      brand: "brand-1",
    },
  ],
};

const mockTemplates = {
  results: [
    {
      id: "template-1",
      name: "Summer Sale",
      description: "Summer sale template",
      campaign_type: "seasonal",
      required_variables: ["discount_percentage"],
      brand: "brand-1",
    },
    {
      id: "template-2",
      name: "Holiday Promo",
      description: "Holiday promotional template",
      campaign_type: "holiday",
      required_variables: [],
      brand: "brand-1",
    },
  ],
};

jest.mock("@/hooks/use-brands", () => ({
  useBrands: () => ({
    data: mockBrands,
    isLoading: false,
  }),
  useLocations: () => ({
    data: mockLocations,
    isLoading: false,
  }),
}));

jest.mock("@/hooks/use-templates", () => ({
  useTemplates: () => ({
    data: mockTemplates,
    isLoading: false,
  }),
}));

const mockToast = jest.fn();
jest.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
  }),
}));

// Helper to wrap component with QueryClientProvider
function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

describe("CampaignForm", () => {
  // Radix UI Select components have internal spans with pointer-events: none
  const user = userEvent.setup({ pointerEventsCheck: 0 });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("rendering", () => {
    it("should render form with all sections", () => {
      renderWithClient(<CampaignForm />);

      expect(screen.getByText("Location")).toBeInTheDocument();
      expect(screen.getByText("Template")).toBeInTheDocument();
      expect(screen.getByText(/schedule/i)).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /create campaign/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /cancel/i })
      ).toBeInTheDocument();
    });

    it("should render brand select", () => {
      renderWithClient(<CampaignForm />);
      expect(screen.getByText("Brand *")).toBeInTheDocument();
    });

    it("should render location select", () => {
      renderWithClient(<CampaignForm />);
      expect(screen.getByText("Location *")).toBeInTheDocument();
    });

    it("should render template select", () => {
      renderWithClient(<CampaignForm />);
      expect(screen.getByText("Campaign Template *")).toBeInTheDocument();
    });

    it("should render schedule fields", () => {
      renderWithClient(<CampaignForm />);
      expect(screen.getByLabelText("Start Date")).toBeInTheDocument();
      expect(screen.getByLabelText("End Date")).toBeInTheDocument();
    });
  });

  describe("form validation", () => {
    it("should show error when submitting without brand", async () => {
      renderWithClient(<CampaignForm />);

      const submitButton = screen.getByRole("button", {
        name: /create campaign/i,
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/brand is required/i)).toBeInTheDocument();
      });
    });

    it("should show multiple validation errors for empty form", async () => {
      renderWithClient(<CampaignForm />);

      const submitButton = screen.getByRole("button", {
        name: /create campaign/i,
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/brand is required/i)).toBeInTheDocument();
        expect(screen.getByText(/location is required/i)).toBeInTheDocument();
        expect(screen.getByText(/template is required/i)).toBeInTheDocument();
      });
    });
  });

  describe("edit mode", () => {
    it("should show Save Changes button when editing", () => {
      const existingCampaign = {
        id: "campaign-1",
        location: "loc-1",
        location_name: "Downtown Store",
        template: "template-1",
        template_name: "Summer Sale",
        brand_name: "Brand One",
        status: "draft" as const,
        customizations: { discount_percentage: "20" },
        generated_content: "Content",
        scheduled_start: null,
        scheduled_end: null,
        created_by: 1,
        created_at: "2024-01-01T00:00:00Z",
      };

      renderWithClient(<CampaignForm campaign={existingCampaign} />);

      expect(
        screen.getByRole("button", { name: /save changes/i })
      ).toBeInTheDocument();
    });

    it("should pre-populate location from existing campaign", () => {
      const existingCampaign = {
        id: "campaign-1",
        location: "loc-1",
        location_name: "Downtown Store",
        template: "template-1",
        template_name: "Summer Sale",
        brand_name: "Brand One",
        status: "draft" as const,
        customizations: {},
        generated_content: "Content",
        scheduled_start: "2024-06-01T09:00",
        scheduled_end: "2024-06-15T18:00",
        created_by: 1,
        created_at: "2024-01-01T00:00:00Z",
      };

      renderWithClient(<CampaignForm campaign={existingCampaign} />);

      // Form should render with Save Changes button indicating edit mode
      expect(
        screen.getByRole("button", { name: /save changes/i })
      ).toBeInTheDocument();
    });
  });

  describe("cancel button", () => {
    it("should navigate back when cancel is clicked", async () => {
      renderWithClient(<CampaignForm />);

      const cancelButton = screen.getByRole("button", { name: /cancel/i });
      await user.click(cancelButton);

      expect(mockBack).toHaveBeenCalled();
    });
  });

  describe("form descriptions", () => {
    it("should display location section description", () => {
      renderWithClient(<CampaignForm />);

      expect(
        screen.getByText(/select the brand and location for this campaign/i)
      ).toBeInTheDocument();
    });

    it("should display template section description", () => {
      renderWithClient(<CampaignForm />);

      expect(
        screen.getByText(/choose a template to generate campaign content/i)
      ).toBeInTheDocument();
    });

    it("should display schedule section description", () => {
      renderWithClient(<CampaignForm />);

      expect(
        screen.getByText(/set when this campaign should run/i)
      ).toBeInTheDocument();
    });
  });
});
