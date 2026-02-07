import { ApolloClient, InMemoryCache } from "@apollo/client/core";
import { createHttpLink } from "@apollo/client/link/http";

const httpLink = createHttpLink({
  uri: import.meta.env.VITE_API_URL || "http://localhost:4000/graphql",
  credentials: "include",
});

export const apolloClient = new ApolloClient({
  link: httpLink,
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: "cache-and-network",
    },
  },
});
