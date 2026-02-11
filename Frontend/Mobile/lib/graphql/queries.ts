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

export const CHECKIN_FRAGMENT = gql`
  fragment CheckInFields on CheckIn {
    id
    status
    checkInTime
    checkOutTime
    hoursLogged
    event {
      ...EventFields
    }
  }
  ${EVENT_FRAGMENT}
`;

// ============================================
// User Queries
// ============================================

export const GET_ME = gql`
  query GetMe {
    me {
      ...UserFields
      memberships {
        id
        role
        hoursRequired
        team {
          id
          name
          season
          sport
          color
          organization {
            id
            name
            image
          }
        }
      }
      organizationMemberships {
        id
        role
        organization {
          id
          name
        }
      }
    }
  }
  ${USER_FRAGMENT}
`;

export const GET_USER = gql`
  query GetUser($id: ID!) {
    user(id: $id) {
      ...UserFields
    }
  }
  ${USER_FRAGMENT}
`;

// ============================================
// Organization Queries
// ============================================

export const GET_MY_ORGANIZATIONS = gql`
  query GetMyOrganizations {
    myOrganizations {
      id
      name
      image
      memberCount
    }
  }
`;

export const GET_ORGANIZATION = gql`
  query GetOrganization($id: ID!) {
    organization(id: $id) {
      id
      name
      image
      teams {
        id
        name
        season
        sport
        color
        description
        memberCount
      }
      memberCount
    }
  }
`;

// ============================================
// Event Queries
// ============================================

export const GET_UPCOMING_EVENTS = gql`
  query GetUpcomingEvents($organizationId: ID!, $limit: Int) {
    upcomingEvents(organizationId: $organizationId, limit: $limit) {
      ...EventFields
      team {
        id
        name
      }
    }
  }
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
    }
  }
  ${EVENT_FRAGMENT}
`;

export const GET_EVENT = gql`
  query GetEvent($id: ID!) {
    event(id: $id) {
      ...EventFields
      team {
        id
        name
      }
      checkIns {
        id
        status
        user {
          id
          firstName
          lastName
          image
        }
      }
    }
  }
  ${EVENT_FRAGMENT}
`;

// ============================================
// Check-in Queries
// ============================================

export const GET_CHECKIN_HISTORY = gql`
  query GetCheckInHistory($userId: ID!, $limit: Int) {
    checkInHistory(userId: $userId, limit: $limit) {
      ...CheckInFields
    }
  }
  ${CHECKIN_FRAGMENT}
`;

export const GET_EVENT_ATTENDANCE = gql`
  query GetEventAttendance($eventId: ID!) {
    eventAttendance(eventId: $eventId) {
      id
      status
      checkInTime
      checkOutTime
      user {
        id
        firstName
        lastName
        image
      }
    }
  }
`;

// ============================================
// Analytics Queries
// ============================================

export const GET_USER_STATS = gql`
  query GetUserStats($userId: ID!, $organizationId: ID!, $timeRange: TimeRange) {
    userStats(userId: $userId, organizationId: $organizationId, timeRange: $timeRange) {
      hoursLogged
      hoursRequired
      attendancePercent
      teamRank
      teamSize
      orgRank
      orgSize
      currentStreak
      bestStreak
    }
  }
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

export const GET_ORGANIZATION_LEADERBOARD = gql`
  query GetOrganizationLeaderboard($organizationId: ID!, $timeRange: TimeRange, $limit: Int) {
    organizationLeaderboard(organizationId: $organizationId, timeRange: $timeRange, limit: $limit) {
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

export const GET_TEAM_RANKINGS = gql`
  query GetTeamRankings($organizationId: ID!, $timeRange: TimeRange) {
    teamRankings(organizationId: $organizationId, timeRange: $timeRange) {
      rank
      attendancePercent
      team {
        id
        name
        season
        sport
        color
        memberCount
      }
    }
  }
`;

export const GET_RECENT_ACTIVITY = gql`
  query GetRecentActivity($organizationId: ID!, $limit: Int) {
    recentActivity(organizationId: $organizationId, limit: $limit) {
      id
      type
      time
      date
      eventTitle
      eventType
      user {
        id
        firstName
        lastName
        image
      }
    }
  }
`;

// ============================================
// Excuse Queries
// ============================================

export const GET_MY_EXCUSE_REQUESTS = gql`
  query GetMyExcuseRequests($userId: ID!) {
    myExcuseRequests(userId: $userId) {
      id
      reason
      status
      event {
        ...EventFields
      }
    }
  }
  ${EVENT_FRAGMENT}
`;

// ============================================
// NFC Queries
// ============================================

export const GET_ORGANIZATION_NFC_TAGS = gql`
  query GetOrganizationNfcTags($organizationId: ID!) {
    organizationNfcTags(organizationId: $organizationId) {
      id
      token
      name
      isActive
      createdBy
      createdAt
    }
  }
`;
