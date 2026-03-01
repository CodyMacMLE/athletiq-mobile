import { ApolloClient, InMemoryCache, createHttpLink, from } from "@apollo/client";
import { setContext } from "@apollo/client/link/context";
import { onError } from "@apollo/client/link/error";
import { persistCache, AsyncStorageWrapper } from "apollo3-cache-persist";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { getAuthToken } from "@/lib/cognito";

const PROD_API_URL = "https://api.athletiq.fitness/graphql";

const getApiUrl = (): string => {
  if (__DEV__) {
    // Derive the local machine IP from the Expo dev server host.
    // Works for iOS Simulator, Android Emulator (via ADB tunnel), and
    // physical devices on the same Wi-Fi network.
    const host = Constants.expoConfig?.hostUri?.split(":").shift();
    if (host) return `http://${host}:4000/graphql`;
    return "http://localhost:4000/graphql";
  }
  return PROD_API_URL;
};

const httpLink = createHttpLink({
  uri: getApiUrl(),
});

const authLink = setContext(async (_, { headers }) => {
  const token = await getAuthToken();
  return {
    headers: {
      ...headers,
      "Content-Type": "application/json",
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

const cache = new InMemoryCache({
  typePolicies: {
    Query: {
      fields: {
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
});

export const apolloClient = new ApolloClient({
  link: from([errorLink, authLink, httpLink]),
  cache,
  defaultOptions: {
    watchQuery: {
      fetchPolicy: "cache-and-network",
    },
  },
});

/**
 * Restores the Apollo InMemoryCache from AsyncStorage.
 * Call this once on app startup before the first render so cached
 * events/attendance data is available immediately (and offline).
 */
export async function restoreApolloCache(): Promise<void> {
  await persistCache({
    cache,
    storage: new AsyncStorageWrapper(AsyncStorage),
  });
}
