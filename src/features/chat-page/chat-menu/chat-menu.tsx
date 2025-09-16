import { sortByTimestamp } from "@/features/common/util";
import { FC } from "react";
import {
  ChatThreadModel,
  MenuItemsGroup,
  MenuItemsGroupName,
} from "../chat-services/models";
import { ChatGroup } from "./chat-group";
import { ChatMenuItem } from "./chat-menu-item";

interface ChatMenuProps {
  menuItems: Array<ChatThreadModel>;
}

export const ChatMenu: FC<ChatMenuProps> = (props) => {
  const menuItemsGrouped = GroupChatThreadByType(props.menuItems);
  return (
    <div className="px-3 flex flex-col gap-8 overflow-hidden">
      {Object.entries(menuItemsGrouped).map(
        ([groupName, groupItems], index) => (
          <ChatGroup key={index} title={groupName}>
            {groupItems?.map((item) => (
              <ChatMenuItem
                key={item.id}
                href={`/chat/${item.id}`}
                chatThread={item}
              >
                <p className="break-all">{item.name.replace("\n", "")}</p>
              </ChatMenuItem>
            ))}
          </ChatGroup>
        )
      )}
    </div>
  );
};

export const GroupChatThreadByType = (menuItems: Array<ChatThreadModel>) => {
  const groupedMenuItems: Array<MenuItemsGroup> = [];

  // Get current time
  const now = new Date().getTime();
  
  // Calculate 7 days ago in milliseconds (7 days * 24 hours * 60 minutes * 60 seconds * 1000 milliseconds)
  const sevenDaysAgoMs = now - (7 * 24 * 60 * 60 * 1000);

  menuItems.sort(sortByTimestamp).forEach((el) => {
    // Convert lastMessageAt to timestamp for reliable comparison
    const lastMessageTimeMs = new Date(el.lastMessageAt).getTime();
    
    if (el.bookmarked) {
      groupedMenuItems.push({
        ...el,
        groupName: "Bookmarked",
      });
    } else if (lastMessageTimeMs >= sevenDaysAgoMs) {
      groupedMenuItems.push({
        ...el,
        groupName: "Past 7 days",
      });
    } else {
      groupedMenuItems.push({
        ...el,
        groupName: "Previous",
      });
    }
  });
  const menuItemsGrouped = groupedMenuItems.reduce((acc, el) => {
    const key = el.groupName;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(el);
    return acc;
  }, {} as Record<MenuItemsGroupName, Array<MenuItemsGroup>>);

  const records: Record<MenuItemsGroupName, Array<MenuItemsGroup>> = {
    Bookmarked: menuItemsGrouped["Bookmarked"]?.sort(sortByTimestamp),
    "Past 7 days": menuItemsGrouped["Past 7 days"]?.sort(sortByTimestamp),
    Previous: menuItemsGrouped["Previous"]?.sort(sortByTimestamp),
  };

  return records;
};
