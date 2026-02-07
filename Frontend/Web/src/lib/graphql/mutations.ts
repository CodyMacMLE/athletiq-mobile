import { gql } from "@apollo/client";
import { USER_FRAGMENT, TEAM_FRAGMENT, EVENT_FRAGMENT } from "./queries";

// ============================================
// User Mutations
// ============================================

export const CREATE_USER = gql`
  mutation CreateUser($input: CreateUserInput!) {
    createUser(input: $input) {
      ...UserFields
    }
  }
  ${USER_FRAGMENT}
`;

export const UPDATE_USER = gql`
  mutation UpdateUser($id: ID!, $input: UpdateUserInput!) {
    updateUser(id: $id, input: $input) {
      ...UserFields
    }
  }
  ${USER_FRAGMENT}
`;

export const DELETE_USER = gql`
  mutation DeleteUser($id: ID!) {
    deleteUser(id: $id)
  }
`;

// ============================================
// Team Mutations
// ============================================

export const CREATE_TEAM = gql`
  mutation CreateTeam($input: CreateTeamInput!) {
    createTeam(input: $input) {
      ...TeamFields
    }
  }
  ${TEAM_FRAGMENT}
`;

export const UPDATE_TEAM = gql`
  mutation UpdateTeam($id: ID!, $name: String) {
    updateTeam(id: $id, name: $name) {
      ...TeamFields
    }
  }
  ${TEAM_FRAGMENT}
`;

export const DELETE_TEAM = gql`
  mutation DeleteTeam($id: ID!) {
    deleteTeam(id: $id)
  }
`;

export const ADD_TEAM_MEMBER = gql`
  mutation AddTeamMember($input: AddTeamMemberInput!) {
    addTeamMember(input: $input) {
      id
      role
      hoursRequired
      user {
        ...UserFields
      }
      team {
        id
        name
      }
    }
  }
  ${USER_FRAGMENT}
`;

export const REMOVE_TEAM_MEMBER = gql`
  mutation RemoveTeamMember($userId: ID!, $teamId: ID!) {
    removeTeamMember(userId: $userId, teamId: $teamId)
  }
`;

export const UPDATE_TEAM_MEMBER_ROLE = gql`
  mutation UpdateTeamMemberRole($userId: ID!, $teamId: ID!, $role: TeamRole!) {
    updateTeamMemberRole(userId: $userId, teamId: $teamId, role: $role) {
      id
      role
      user {
        id
        firstName
        lastName
      }
    }
  }
`;

// ============================================
// Event Mutations
// ============================================

export const CREATE_EVENT = gql`
  mutation CreateEvent($input: CreateEventInput!) {
    createEvent(input: $input) {
      ...EventFields
    }
  }
  ${EVENT_FRAGMENT}
`;

export const UPDATE_EVENT = gql`
  mutation UpdateEvent(
    $id: ID!
    $title: String
    $type: EventType
    $date: String
    $startTime: String
    $endTime: String
    $location: String
    $description: String
  ) {
    updateEvent(
      id: $id
      title: $title
      type: $type
      date: $date
      startTime: $startTime
      endTime: $endTime
      location: $location
      description: $description
    ) {
      ...EventFields
    }
  }
  ${EVENT_FRAGMENT}
`;

export const DELETE_EVENT = gql`
  mutation DeleteEvent($id: ID!) {
    deleteEvent(id: $id)
  }
`;

// ============================================
// Attendance Mutations
// ============================================

export const MARK_ABSENT = gql`
  mutation MarkAbsent($userId: ID!, $eventId: ID!) {
    markAbsent(userId: $userId, eventId: $eventId) {
      id
      status
    }
  }
`;

// ============================================
// Excuse Mutations
// ============================================

export const UPDATE_EXCUSE_REQUEST = gql`
  mutation UpdateExcuseRequest($input: UpdateExcuseRequestInput!) {
    updateExcuseRequest(input: $input) {
      id
      status
      user {
        id
        firstName
        lastName
      }
      event {
        id
        title
      }
    }
  }
`;
