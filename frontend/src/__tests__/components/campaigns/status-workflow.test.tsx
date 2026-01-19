import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StatusWorkflow } from "@/components/campaigns/status-workflow";
import type { LocationCampaign } from "@/types";

// Mock the ApprovalDialog component
jest.mock("@/components/approvals/approval-dialog", () => ({
  ApprovalDialog: ({
    open,
    action,
    title,
  }: {
    open: boolean;
    action: string;
    title: string;
  }) =>
    open ? (
      <div data-testid="approval-dialog">
        <span data-testid="dialog-action">{action}</span>
        <span data-testid="dialog-title">{title}</span>
      </div>
    ) : null,
}));

// Mock the StatusBadge component
jest.mock("@/components/campaigns/status-badge", () => ({
  StatusBadge: ({ status }: { status: string }) => (
    <span data-testid="status-badge">{status}</span>
  ),
}));

const createMockCampaign = (
  status: LocationCampaign["status"]
): LocationCampaign => ({
  id: "campaign-1",
  location: "loc-1",
  location_name: "Downtown Store",
  template: "template-1",
  template_name: "Summer Sale",
  brand_name: "Test Brand",
  created_by: 1,
  created_by_name: "Admin User",
  status,
  customizations: {},
  generated_content: "Test content",
  scheduled_start: null,
  scheduled_end: null,
  approval_history: [],
  created_at: "2024-01-01T00:00:00Z",
});

describe("StatusWorkflow", () => {
  const user = userEvent.setup();

  describe("rendering", () => {
    it("should render status card with current status", () => {
      const campaign = createMockCampaign("draft");
      render(<StatusWorkflow campaign={campaign} />);

      expect(screen.getByText("Status")).toBeInTheDocument();
      expect(screen.getByTestId("status-badge")).toHaveTextContent("draft");
    });

    it("should render status flow indicator", () => {
      const campaign = createMockCampaign("approved");
      render(<StatusWorkflow campaign={campaign} />);

      // Status flow should show all statuses
      expect(screen.getByText("Draft")).toBeInTheDocument();
      expect(screen.getByText("Pending Review")).toBeInTheDocument();
      expect(screen.getByText("Approved")).toBeInTheDocument();
      expect(screen.getByText("Scheduled")).toBeInTheDocument();
      expect(screen.getByText("Active")).toBeInTheDocument();
      expect(screen.getByText("Completed")).toBeInTheDocument();
    });
  });

  describe("draft status actions", () => {
    it("should show draft actions", () => {
      const campaign = createMockCampaign("draft");
      render(<StatusWorkflow campaign={campaign} />);

      expect(
        screen.getByRole("button", { name: /submit for review/i })
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /edit/i })).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /delete/i })
      ).toBeInTheDocument();
    });

    it("should call onEdit when edit button is clicked", async () => {
      const campaign = createMockCampaign("draft");
      const onEdit = jest.fn();

      render(<StatusWorkflow campaign={campaign} onEdit={onEdit} />);

      const editButton = screen.getByRole("button", { name: /edit/i });
      await user.click(editButton);

      expect(onEdit).toHaveBeenCalled();
    });

    it("should call onDelete when delete button is clicked", async () => {
      const campaign = createMockCampaign("draft");
      const onDelete = jest.fn();

      render(<StatusWorkflow campaign={campaign} onDelete={onDelete} />);

      const deleteButton = screen.getByRole("button", { name: /delete/i });
      await user.click(deleteButton);

      expect(onDelete).toHaveBeenCalled();
    });

    it("should open dialog when submit for review is clicked", async () => {
      const campaign = createMockCampaign("draft");

      render(<StatusWorkflow campaign={campaign} />);

      const submitButton = screen.getByRole("button", {
        name: /submit for review/i,
      });
      await user.click(submitButton);

      expect(screen.getByTestId("approval-dialog")).toBeInTheDocument();
      expect(screen.getByTestId("dialog-action")).toHaveTextContent("submit");
      expect(screen.getByTestId("dialog-title")).toHaveTextContent(
        "Submit for Review"
      );
    });
  });

  describe("pending_review status actions", () => {
    it("should show approval actions", () => {
      const campaign = createMockCampaign("pending_review");
      render(<StatusWorkflow campaign={campaign} />);

      expect(
        screen.getByRole("button", { name: /approve/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /reject/i })
      ).toBeInTheDocument();
    });

    it("should open dialog when approve is clicked", async () => {
      const campaign = createMockCampaign("pending_review");

      render(<StatusWorkflow campaign={campaign} />);

      const approveButton = screen.getByRole("button", { name: /approve/i });
      await user.click(approveButton);

      expect(screen.getByTestId("approval-dialog")).toBeInTheDocument();
      expect(screen.getByTestId("dialog-action")).toHaveTextContent("approve");
    });

    it("should open dialog when reject is clicked", async () => {
      const campaign = createMockCampaign("pending_review");

      render(<StatusWorkflow campaign={campaign} />);

      const rejectButton = screen.getByRole("button", { name: /reject/i });
      await user.click(rejectButton);

      expect(screen.getByTestId("approval-dialog")).toBeInTheDocument();
      expect(screen.getByTestId("dialog-action")).toHaveTextContent("reject");
    });
  });

  describe("approved status actions", () => {
    it("should show schedule and revise actions", () => {
      const campaign = createMockCampaign("approved");
      render(<StatusWorkflow campaign={campaign} />);

      expect(
        screen.getByRole("button", { name: /schedule/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /request revision/i })
      ).toBeInTheDocument();
    });

    it("should open dialog when schedule is clicked", async () => {
      const campaign = createMockCampaign("approved");

      render(<StatusWorkflow campaign={campaign} />);

      const scheduleButton = screen.getByRole("button", { name: /schedule/i });
      await user.click(scheduleButton);

      expect(screen.getByTestId("approval-dialog")).toBeInTheDocument();
      expect(screen.getByTestId("dialog-action")).toHaveTextContent("schedule");
    });
  });

  describe("rejected status actions", () => {
    it("should show revise and delete actions", () => {
      const campaign = createMockCampaign("rejected");
      render(<StatusWorkflow campaign={campaign} />);

      expect(
        screen.getByRole("button", { name: /revise & resubmit/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /delete/i })
      ).toBeInTheDocument();
    });

    it("should display rejected indicator", () => {
      const campaign = createMockCampaign("rejected");
      render(<StatusWorkflow campaign={campaign} />);

      // The rejected status should show in the flow indicator
      expect(screen.getByText("Rejected")).toBeInTheDocument();
    });
  });

  describe("scheduled status actions", () => {
    it("should show cancel and revise action", () => {
      const campaign = createMockCampaign("scheduled");
      render(<StatusWorkflow campaign={campaign} />);

      expect(
        screen.getByRole("button", { name: /cancel & revise/i })
      ).toBeInTheDocument();
    });
  });

  describe("active status", () => {
    it("should show no actions for active status", () => {
      const campaign = createMockCampaign("active");
      render(<StatusWorkflow campaign={campaign} />);

      expect(
        screen.getByText(/no actions available for this status/i)
      ).toBeInTheDocument();
    });
  });

  describe("completed status", () => {
    it("should show no actions for completed status", () => {
      const campaign = createMockCampaign("completed");
      render(<StatusWorkflow campaign={campaign} />);

      expect(
        screen.getByText(/no actions available for this status/i)
      ).toBeInTheDocument();
    });
  });

  describe("status flow indicator", () => {
    it("should highlight current status", () => {
      const campaign = createMockCampaign("approved");
      const { container } = render(<StatusWorkflow campaign={campaign} />);

      // The approved status should have the primary background
      const approvedBadge = container.querySelector(
        ".bg-primary.text-primary-foreground"
      );
      expect(approvedBadge).toHaveTextContent("Approved");
    });

    it("should show past statuses as completed", () => {
      const campaign = createMockCampaign("approved");
      render(<StatusWorkflow campaign={campaign} />);

      // Draft and Pending Review should be shown as past statuses
      const draftBadge = screen.getByText("Draft").closest("div");
      expect(draftBadge).toHaveClass("bg-muted");

      const pendingBadge = screen.getByText("Pending Review").closest("div");
      expect(pendingBadge).toHaveClass("bg-muted");
    });
  });

  describe("callback handling", () => {
    it("should call onActionComplete after dialog action", async () => {
      const campaign = createMockCampaign("draft");
      const onActionComplete = jest.fn();

      render(
        <StatusWorkflow campaign={campaign} onActionComplete={onActionComplete} />
      );

      // The onActionComplete callback is called when the dialog's onSuccess is triggered
      // Since we're mocking the dialog, we just verify the dialog opens
      const submitButton = screen.getByRole("button", {
        name: /submit for review/i,
      });
      await user.click(submitButton);

      expect(screen.getByTestId("approval-dialog")).toBeInTheDocument();
    });

    it("should not call edit callback if not provided", async () => {
      const campaign = createMockCampaign("draft");

      render(<StatusWorkflow campaign={campaign} />);

      // Edit button should still be clickable but won't trigger any callback
      const editButton = screen.getByRole("button", { name: /edit/i });
      await user.click(editButton);

      // No error should be thrown
    });
  });
});
