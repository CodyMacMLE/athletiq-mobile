import { ApolloClient, InMemoryCache, createHttpLink, from } from "@apollo/client";
import { setContext } from "@apollo/client/link/context";
import { onError } from "@apollo/client/link/error";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { getAuthToken } from "@/lib/cognito";

// Use different URLs for iOS simulator vs Android emulator vs physical device
const getApiUrl = () => {
  if (__DEV__) {
    // Android emulator uses 10.0.2.2 to reach host machine's localhost
    if (Platform.OS === "android") {
      return "http://10.0.2.2:4000/graphql";
    }
    // Physical devices: use the dev server host IP (from Metro bundler)
    // Simulator: localhost works directly
    const debuggerHost = Constants.expoConfig?.hostUri?.split(":")[0];
    if (debuggerHost && debuggerHost !== "localhost" && debuggerHost !== "127.0.0.1") {
      return `http://${debuggerHost}:4000/graphql`;
    }
    return "http://localhost:4000/graphql";
  }
  // Production URL
  return "https://api.athletiq.fitness/graphql";
};

const httpLink = createHttpLink({
  uri: getApiUrl(),
});

const authLink = setContext(async (_, { headers }) => {
  const token = await getAuthToken();
  return {
    headers: {
      ...headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };
});

const errorLink = onError(({ graphQLErrors, networkError }) => {
  if (graphQLErrors) {
    graphQLErrors.forEach(({ message, locations, path }) =>
      console.error(`[GraphQL error]: Message: ${message}, Path: ${path}`)
    );
  }
  if (networkError) {
    console.error(`[Network error]: ${networkError}`);
  }
});

export const apolloClient = new ApolloClient({
  link: from([errorLink, authLink, httpLink]),
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
