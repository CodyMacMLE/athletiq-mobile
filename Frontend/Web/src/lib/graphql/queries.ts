import { gql } from "@apollo/client";

// ============================================
// Fragments
// ============================================

export const USER_FRAGMENT = gql`
  fragment UserFields on User {
    id
    email
    firstName
    lastName
    phone
    address
    city
    country
    image
    createdAt
  }
`;

export const TEAM_FRAGMENT = gql`
  fragment TeamFields on Team {
    id
    name
    memberCount
    attendancePercent(timeRange: MONTH)
  }
`;

export const EVENT_FRAGMENT = gql`
  fragment EventFields on Event {
    id
    title
    type
    date
    startTime
    endTime
    location
    description
  }
`;

// ============================================
// Admin Queries
// ============================================

export const GET_ME = gql`
  query GetMe {
    me {
      ...UserFields
      memberships {
        id
        role
        team {
          id
          name
          organization {
            id
            name
          }
        }
      }
    }
  }
  ${USER_FRAGMENT}
`;

export const GET_ORGANIZATION = gql`
  query GetOrganization($id: ID!) {
    organization(id: $id) {
      id
      name
      image
      memberCount
      teams {
        ...TeamFields
      }
    }
  }
  ${TEAM_FRAGMENT}
`;

export const GET_ORGANIZATION_MEMBERS = gql`
  query GetOrganizationMembers($organizationId: ID!) {
    teams(organizationId: $organizationId) {
      id
      name
      members {
        id
        role
        hoursRequired
        hoursLogged(timeRange: MONTH)
        attendancePercent(timeRange: MONTH)
        joinedAt
        user {
          ...UserFields
        }
      }
    }
  }
  ${USER_FRAGMENT}
`;

export const GET_TEAMS = gql`
  query GetTeams($organizationId: ID!) {
    teams(organizationId: $organizationId) {
      ...TeamFields
      members {
        id
        role
        user {
          id
          firstName
          lastName
          image
        }
      }
    }
  }
  ${TEAM_FRAGMENT}
`;

export const GET_TEAM = gql`
  query GetTeam($id: ID!) {
    team(id: $id) {
      ...TeamFields
      organization {
        id
        name
      }
      members {
        id
        role
        hoursRequired
        hoursLogged(timeRange: MONTH)
        attendancePercent(timeRange: MONTH)
        joinedAt
        user {
          ...UserFields
        }
      }
      events {
        ...EventFields
      }
    }
  }
  ${TEAM_FRAGMENT}
  ${USER_FRAGMENT}
  ${EVENT_FRAGMENT}
`;

export const GET_EVENTS = gql`
  query GetEvents($organizationId: ID!, $startDate: String, $endDate: String) {
    events(organizationId: $organizationId, startDate: $startDate, endDate: $endDate) {
      ...EventFields
      team {
        id
        name
      }
      checkIns {
        id
        status
      }
    }
  }
  ${EVENT_FRAGMENT}
`;

export const GET_EVENT_ATTENDANCE = gql`
  query GetEventAttendance($eventId: ID!) {
    eventAttendance(eventId: $eventId) {
      id
      status
      checkInTime
      checkOutTime
      hoursLogged
      user {
        ...UserFields
      }
    }
  }
  ${USER_FRAGMENT}
`;

export const GET_PENDING_EXCUSE_REQUESTS = gql`
  query GetPendingExcuseRequests($organizationId: ID!) {
    pendingExcuseRequests(organizationId: $organizationId) {
      id
      reason
      status
      createdAt
      user {
        id
        firstName
        lastName
        image
      }
      event {
        ...EventFields
      }
    }
  }
  ${EVENT_FRAGMENT}
`;

export const GET_TEAM_LEADERBOARD = gql`
  query GetTeamLeaderboard($teamId: ID!, $timeRange: TimeRange, $limit: Int) {
    teamLeaderboard(teamId: $teamId, timeRange: $timeRange, limit: $limit) {
      rank
      attendancePercent
      hoursLogged
      hoursRequired
      user {
        id
        firstName
        lastName
        image
      }
    }
  }
`;

export const GET_ORGANIZATION_STATS = gql`
  query GetOrganizationStats($organizationId: ID!, $timeRange: TimeRange) {
    teamRankings(organizationId: $organizationId, timeRange: $timeRange) {
      rank
      attendancePercent
      team {
        id
        name
        memberCount
      }
    }
  }
`;

export const GET_USERS = gql`
  query GetUsers {
    users {
      ...UserFields
    }
  }
  ${USER_FRAGMENT}
`;
