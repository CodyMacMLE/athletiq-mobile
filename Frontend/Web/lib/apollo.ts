"use client";

import { ApolloClient, InMemoryCache, from } from "@apollo/client/core";
import { createHttpLink } from "@apollo/client/link/http";
import { onError } from "@apollo/client/link/error";
import { setContext } from "@apollo/client/link/context";
import { getAuthToken } from "@/lib/cognito";

const httpLink = createHttpLink({
  uri: process.env.NEXT_PUBLIC_API_URL || "https://api.athletiq.fitness/graphql",
});

const authLink = setContext(async (_, { headers }) => {
  try {
    const token = await getAuthToken();
    return {
      headers: {
        ...headers,
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
    };
  } catch {
    return { headers };
  }
});

const errorLink = onError((error: any) => {
  if (error.graphQLErrors) {
    error.graphQLErrors.forEach(({ message, locations, path }: any) =>
      console.error(`[GraphQL error]: Message: ${message}, Location: ${locations}, Path: ${path}`)
    );
  }
  if (error.networkError) {
    console.error(`[Network error]: ${error.networkError}`);
  }
});

export const apolloClient = new ApolloClient({
  link: from([errorLink, authLink, httpLink]),
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: "cache-and-network",
    },
  },
});
