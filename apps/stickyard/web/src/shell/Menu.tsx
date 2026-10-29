import { SiteLinks } from "@krishnabuilds/ui";
import { CircleHelp, ClipboardList, Download, Info, Menu as MenuIcon, Upload, MessageCircle, QrCode, Settings, Sparkles, Users, WandSparkles, type LucideIcon } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useWhatsNew } from "../changelog/whatsNew";
import { Button, buttonVariants } from "../components/ui/button";
import { Panel } from "../components/ui/panel";
import { chatLabel } from "../chat/ChatDock";
import { useRoomUi, useUnread } from "../rooms/roomStore";
import { useShare } from "../share/shareStore";
import { useExport } from "../export/exportStore";
import { useImport } from "../importer/importStore";
import { useSettings } from "../settings/settingsStore";
import { useSetup } from "../ai/setupStore";
import { useSummary } from "../ai/summaryStore";
import { cn } from "../lib/utils";
import type { Sheet } from "../router";
import { openSheet } from "./nav";

interface MenuItem {
  label: string;
  icon: LucideIcon;
  /** A sheet to open, or an action. */
  sheet?: Sheet;
  action?: () => void;
  /** Off with this reason (shown in the item and as its tooltip; still focusable). */
  reason?: () => string | null;
}

/*
 * Menu groups, separated by dividers. Later slices add their own groups here (for example
 * export) when those features exist. No placeholders until then. The Session group is shown
 * only while you're in a session (see SESSION_GROUP).
 */
const SESSION_GROUP: MenuItem[] = [
  { label: "Participants", icon: Users, sheet: { kind: "participants" } },
  { label: "Chat", icon: MessageCircle, action: () => useRoomUi.getState().openChat() },
  // v0.32.0: the join link as a QR code (share/ShareSheet.tsx); everyone in a session, like Copy link.
  { label: "Share session", icon: QrCode, action: () => useShare.getState().show() },
  // v0.40.0: PNG, Markdown and the board file (export/ExportSheet.tsx); everyone, every width (phones have no Properties).
  { label: "Export board", icon: Download, action: () => useExport.getState().show() },
  // v0.40.0: Import (importer/ImportSheet.tsx), beside Export; off with the reason inside the sheet.
  { label: "Import", icon: Upload, action: () => useImport.getState().show() },
  // v0.43.0: Set up board from a prompt (ai/SetupSheet.tsx); needs a board, so in a session only. Off with the reason inside the sheet.
  { label: "Set up board from a prompt", icon: WandSparkles, action: () => useSetup.getState().show() },
  // v0.44.0: Summarise board (ai/SummarySheet.tsx); host only, off during a silent round, with the reason in the item.
  { label: "Summarise board", icon: ClipboardList, action: () => useSummary.getState().show(), reason: () => useSummary.getState().gate },
];

const GROUPS: MenuItem[][] = [
  [
    { label: "Help", icon: CircleHelp, sheet: { kind: "help" } },
    { label: "What’s new", icon: Sparkles, sheet: { kind: "changelog" } },
  ],
  [
    // v0.42.0: Settings (settings/SettingsSheet.tsx), on every screen, with or without a room.
    { label: "Settings", icon: Settings, action: () => useSettings.getState().show() },
    { label: "About Stickyard", icon: Info, sheet: { kind: "about" } },
  ],
];

/** The site links (krishnabuilds.dev and the other apps) below the menu, styled like its items. */
const siteLink = cn(buttonVariants({ variant: "ghost" }), "w-full justify-start");

/** "Unread release notes" dot. Decorative; the button's label says it in words. */
export function UnseenDot() {
  return (
    <span
      aria-hidden="true"
      data-testid="unseen-dot"
      className="absolute top-ms right-ms size-badge rounded-full bg-accent ring-(length:--sy-badge-ring) ring-surface"
    />
  );
}

/*
 * The top bar menu: a popover of icon + label items. Below the commands, outside the menu role,
 * are the site links: plain links, not commands. Tab from a command moves to the first link,
 * Shift+Tab from the first link back to the last command; Tab past the last link, or focus
 * anywhere outside the popover, closes it. Escape in the links closes and returns to the button.
 */
export function Menu() {
  const [open, setOpen] = useState(false);
  const unseen = useWhatsNew((s) => s.unseen);
  const inRoom = useRoomUi((s) => s.room !== null);
  const unread = useUnread();
  // Re-render when the summary's reason changes (items read it through `reason`).
  useSummary((s) => s.gate);
  const groups = inRoom ? [SESSION_GROUP, ...GROUPS] : GROUPS;
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const linksRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const items = () => Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);

  useEffect(() => {
    if (!open) return;
    items()[0]?.focus();
    const outside = (target: EventTarget | null) =>
      !menuRef.current?.contains(target as Node) && !buttonRef.current?.contains(target as Node);
    const onPointerDown = (e: PointerEvent) => {
      if (outside(e.target)) setOpen(false);
    };
    // Tab past the last site link (or focus moving anywhere else) closes the menu.
    const onFocusIn = (e: FocusEvent) => {
      if (outside(e.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("focusin", onFocusIn);
    };
  }, [open]);

  const links = () => Array.from(linksRef.current?.querySelectorAll<HTMLElement>("a[href]") ?? []);

  const onMenuKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const list = items();
    const index = list.indexOf(document.activeElement as HTMLElement);
    const move = (to: number) => {
      e.preventDefault();
      list[(to + list.length) % list.length]?.focus();
    };
    switch (e.key) {
      case "ArrowDown":
        return move(index + 1);
      case "ArrowUp":
        return move(index - 1);
      case "Home":
        return move(0);
      case "End":
        return move(list.length - 1);
      case "Escape":
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
        buttonRef.current?.focus();
        return;
      case "Tab":
        if (e.shiftKey) return setOpen(false);
        // Into the site links, below the commands.
        e.preventDefault();
        links()[0]?.focus();
        return;
    }
  };

  const onLinksKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      buttonRef.current?.focus();
    } else if (e.key === "Tab" && e.shiftKey && e.target === links()[0]) {
      // Back to the last command.
      e.preventDefault();
      items().at(-1)?.focus();
    }
  };

  const choose = (item: MenuItem) => {
    if (item.reason?.()) return;
    setOpen(false);
    // Focus goes back to the menu button, so closing the sheet returns it there.
    buttonRef.current?.focus();
    if (item.sheet) openSheet(item.sheet);
    item.action?.();
  };

  const label = unseen ? "Menu (new: what’s changed)" : "Menu";

  return (
    <div className="relative">
      <Button
        ref={buttonRef}
        variant="ghost"
        size="icon"
        aria-label={label}
        title="Menu"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((v) => !v)}
        className="relative"
      >
        <MenuIcon />
        {unseen && <UnseenDot />}
      </Button>
      {open && (
        <Panel
          ref={menuRef}
          className="sy-fade-in absolute top-full right-0 z-40 mt-xs flex max-h-(--sy-menu-max-h) w-menu max-w-[calc(100vw-2*var(--sy-gutter))] flex-col overflow-y-auto p-xs shadow-lg"
        >
          <div id={menuId} role="menu" aria-label="Menu" onKeyDown={onMenuKeyDown} className="flex shrink-0 flex-col">
            {groups.map((group, g) => (
              <div key={g} role="group" className="flex flex-col">
                {g > 0 && <div role="separator" className="my-xs h-px bg-border" />}
                {group.map((item) => {
                  const reason = item.reason?.() ?? null;
                  return (
                  <Button
                    key={item.label}
                    role="menuitem"
                    tabIndex={-1}
                    variant="ghost"
                    className={reason ? "h-auto min-h-touch justify-start py-xs text-fg-muted" : "justify-start"}
                    aria-disabled={reason ? true : undefined}
                    title={reason ?? undefined}
                    onClick={() => choose(item)}
                  >
                    <item.icon />
                    <span className="flex flex-1 flex-col text-left">
                      {item.label === "Chat" ? chatLabel(unread) : item.label}
                      {reason && (
                        <span data-menu-reason="" className="text-xs font-normal whitespace-normal">
                          {reason}
                        </span>
                      )}
                    </span>
                    {item.sheet?.kind === "changelog" && unseen && (
                      <span className="rounded-full bg-accent px-sm text-xs font-semibold text-accent-fg">New</span>
                    )}
                  </Button>
                  );
                })}
              </div>
            ))}
          </div>
          <div aria-hidden="true" className="my-xs h-px shrink-0 bg-border" />
          <div ref={linksRef} onKeyDown={onLinksKeyDown} className="shrink-0">
            <SiteLinks
              current="Stickyard"
              classNames={{
                root: "flex flex-col",
                home: cn(siteLink, "font-semibold"),
                list: "flex flex-col",
                link: cn(siteLink, "aria-[current=page]:bg-accent-subtle aria-[current=page]:font-semibold"),
              }}
            />
          </div>
        </Panel>
      )}
    </div>
  );
}
