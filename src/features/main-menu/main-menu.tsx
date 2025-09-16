import { MenuTrayToggle } from "@/features/main-menu/menu-tray-toggle";
import {
  Menu,
  MenuBar,
  MenuItem,
  MenuItemContainer,
  menuIconProps,
} from "@/ui/menu";
import {
  BarChart3,
  Book,
  Home,
  MessageCircle,
  PocketKnife,
  Sheet,
  VenetianMask,
  Newspaper,
  Settings,
} from "lucide-react";
import { getCurrentUser } from "../auth-page/helpers";
import { MenuLink } from "./menu-link";
import { UserProfile } from "./user-profile";

export const MainMenu = async () => {
  const user = await getCurrentUser();

  return (
    <Menu>
      <MenuBar>
        <MenuItemContainer>
          <MenuItem tooltip="Home" asChild>
            <MenuLink href="/chat" ariaLabel="Go to the Home page">
              <Home {...menuIconProps} />
            </MenuLink>
          </MenuItem>
          <MenuTrayToggle />
        </MenuItemContainer>
        <MenuItemContainer>
          <MenuItem tooltip="Chat">
            <MenuLink href="/chat" ariaLabel="Go to the Chat page">
              <MessageCircle {...menuIconProps} />
            </MenuLink>
          </MenuItem>
          <MenuItem tooltip="Persona">
            <MenuLink
              href="/persona"
              ariaLabel="Go to the Persona configuration page"
            >
              <VenetianMask {...menuIconProps} />
            </MenuLink>
          </MenuItem>
          {user.isAdmin && (
            <>
          <MenuItem tooltip="extensions">
            <MenuLink href="/extensions" ariaLabel="Go to the Extensions configuration page">
              <PocketKnife {...menuIconProps} />
            </MenuLink>
          </MenuItem>
          </>
          )}
          <MenuItem tooltip="prompts">
            <MenuLink
              href="/prompt"
              ariaLabel="Go to the Prompt Library configuration page"
            >
              <Book {...menuIconProps} />
            </MenuLink>
          </MenuItem>
          {user.isAdmin && (
            <>
              <MenuItem tooltip="Models">
                <MenuLink
                  href="/admin/models"
                  ariaLabel="Go to Model Configuration"
                >
                  <Settings {...menuIconProps} />
                </MenuLink>
              </MenuItem>
              <MenuItem tooltip="News">
                <MenuLink
                  href="/news"
                  ariaLabel="Go to News Admin"
                >
                  <Newspaper {...menuIconProps} />
                </MenuLink>
              </MenuItem>
            </>
          )}
          {user.isAdmin && (
            <>
              <MenuItem tooltip="reporting">
                <MenuLink
                  href="/reporting"
                  ariaLabel="Go to the Admin reporting"
                >
                  <Sheet {...menuIconProps} />
                </MenuLink>
              </MenuItem>
              {process.env.ANALYTICS_EXTERNAL_URL && (
                <MenuItem tooltip="Chat Analytics" asChild>
                  <a
                    href={process.env.ANALYTICS_EXTERNAL_URL}
                    aria-label="Go to Chat Analytics Dashboard"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <BarChart3 {...menuIconProps} />
                  </a>
                </MenuItem>
              )}
            </>
          )}
        </MenuItemContainer>
        <MenuItemContainer>
          <MenuItem tooltip="Profile">
            <UserProfile />
          </MenuItem>
        </MenuItemContainer>
      </MenuBar>
    </Menu>
  );
};
