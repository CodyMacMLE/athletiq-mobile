import { ApolloClient, InMemoryCache, createHttpLink, from } from "@apollo/client";
import { setContext } from "@apollo/client/link/context";
import { onError } from "@apollo/client/link/error";
import { persistCache, AsyncStorageWrapper } from "apollo3-cache-persist";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getAuthToken } from "@/lib/cognito";

const API_URL = "https://api.athletiq.fitness/graphql";

const getApiUrl = () => API_URL;

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
