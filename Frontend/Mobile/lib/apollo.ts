import { ApolloClient, InMemoryCache, createHttpLink } from "@apollo/client";
import { Platform } from "react-native";

// Use different URLs for iOS simulator vs Android emulator vs physical device
const getApiUrl = () => {
  if (__DEV__) {
    // Android emulator uses 10.0.2.2 to reach host machine's localhost
    // iOS simulator can use localhost directly
    // Physical devices need the actual IP address of your machine
    if (Platform.OS === "android") {
      return "http://10.0.2.2:4000/graphql";
    }
    return "http://localhost:4000/graphql";
  }
  // Production URL - update this when you deploy
  return "https://api.athletiq.app/graphql";
};

const httpLink = createHttpLink({
  uri: getApiUrl(),
});

export const apolloClient = new ApolloClient({
  link: httpLink,
  cache: new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          // Cache policies for frequently accessed data
          upcomingEvents: {
            merge(existing, incoming) {
              return incoming;
            },
          },
          checkInHistory: {
            merge(existing, incoming) {
              return incoming;
            },
          },
        },
      },
    },
  }),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: "cache-and-network",
    },
  },
});
