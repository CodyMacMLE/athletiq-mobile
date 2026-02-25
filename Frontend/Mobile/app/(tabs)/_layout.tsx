import { useAuth } from "@/contexts/AuthContext";
import { OfflineBanner } from "@/components/OfflineBanner";
import Feather from "@expo/vector-icons/Feather";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Redirect, Tabs } from "expo-router";
import type { ComponentProps } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type IconName = ComponentProps<typeof Feather>["name"];

const TAB_ICONS: Record<string, IconName> = {
  index: "home",
  analytics: "trending-up",
  calendar: "calendar",
  messages: "activity",
  profile: "user",
};

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
              <Feather
                name={route.name === "messages" && isTeamCoach && !isViewingAsGuardian ? "users" : (TAB_ICONS[route.name] ?? "circle")}
                size={24}
                color={focused ? "#E6F4FE" : "rgba(255,255,255,0.35)"}
              />
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
    <>
      <OfflineBanner />
      <Tabs
        tabBar={(props) => <GlassTabBar {...props} />}
        screenOptions={{ headerShown: false }}
      >
        <Tabs.Screen name="index" options={{ href: hasOrg ? undefined : null }} />
        <Tabs.Screen name="analytics" options={{ href: hasOrg ? undefined : null }} />
        <Tabs.Screen name="calendar" options={{ href: hasOrg ? undefined : null }} />
        <Tabs.Screen name="messages" options={{ href: hasOrg ? undefined : null }} />
        <Tabs.Screen name="profile" />
      </Tabs>
    </>
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
});
