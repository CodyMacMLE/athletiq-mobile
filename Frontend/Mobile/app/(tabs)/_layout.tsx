import { useAuth } from "@/contexts/AuthContext";
import { GET_NOTIFICATION_HISTORY } from "@/lib/graphql/queries";
import { useQuery } from "@apollo/client";
import Feather from "@expo/vector-icons/Feather";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Redirect, Tabs } from "expo-router";
import type { ComponentProps } from "react";
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type IconName = ComponentProps<typeof Feather>["name"];

const TAB_ICONS: Record<string, IconName> = {
  index: "home",
  analytics: "trending-up",
  calendar: "calendar",
  notifications: "bell",
  messages: "activity",
  profile: "user",
};

function UnreadBadge() {
  const { user } = useAuth();
  const { data } = useQuery(GET_NOTIFICATION_HISTORY, {
    variables: { limit: 100 },
    skip: !user,
    fetchPolicy: "cache-and-network",
    pollInterval: 60000, // refresh every minute
  });

  const count = useMemo(() => {
    if (!data?.notificationHistory) return 0;
    return data.notificationHistory.filter((n: any) => !n.readAt).length;
  }, [data]);

  if (count === 0) return null;

  return (
    <View style={badgeStyles.badge}>
      <Text style={badgeStyles.badgeText}>{count > 99 ? "99+" : count}</Text>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  badge: {
    position: "absolute",
    top: -5,
    right: -8,
    backgroundColor: "#e74c3c",
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: "white",
    fontSize: 10,
    fontWeight: "700",
    lineHeight: 12,
  },
});

function GlassTabBar({ state, navigation }: BottomTabBarProps) {
  const { bottom } = useSafeAreaInsets();
  const { isTeamCoach, isViewingAsGuardian } = useAuth();

  return (
    <View style={[styles.tabBarWrapper, { height: 56 + bottom }]}>
      <View style={[StyleSheet.absoluteFill, styles.tabBarBackground]} />
      <View style={[styles.tabBarContent, { paddingBottom: bottom }]}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const iconName: IconName =
            route.name === "messages" && isTeamCoach && !isViewingAsGuardian
              ? "users"
              : (TAB_ICONS[route.name] ?? "circle");

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              style={styles.tabItem}
              android_ripple={{
                color: "rgba(255,255,255,0.1)",
                borderless: true,
              }}
            >
              <View style={styles.iconWrapper}>
                <Feather
                  name={iconName}
                  size={24}
                  color={focused ? "#E6F4FE" : "rgba(255,255,255,0.35)"}
                />
                {route.name === "notifications" && <UnreadBadge />}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  const { isAuthenticated, organizations } = useAuth();

  if (!isAuthenticated) {
    return <Redirect href="/login" />;
  }

  const hasOrg = organizations.length > 0;

  return (
    <Tabs
      tabBar={(props) => <GlassTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" options={{ href: hasOrg ? undefined : null }} />
      <Tabs.Screen name="analytics" options={{ href: hasOrg ? undefined : null }} />
      <Tabs.Screen name="calendar" options={{ href: hasOrg ? undefined : null }} />
      <Tabs.Screen name="notifications" options={{ href: hasOrg ? undefined : null }} />
      <Tabs.Screen name="messages" options={{ href: hasOrg ? undefined : null }} />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBarWrapper: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.1)",
    overflow: "hidden",
  },
  tabBarBackground: {
    backgroundColor: "rgba(30, 25, 60, 0.85)",
  },
  tabBarContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
  },
  iconWrapper: {
    position: "relative",
  },
});
