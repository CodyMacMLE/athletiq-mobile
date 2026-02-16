import { gql } from "@apollo/client";
import { USER_FRAGMENT, TEAM_FRAGMENT, EVENT_FRAGMENT, INVITE_FRAGMENT } from "./queries";

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

export const REMOVE_ORG_MEMBER = gql`
  mutation RemoveOrgMember($userId: ID!, $organizationId: ID!) {
    removeOrgMember(userId: $userId, organizationId: $organizationId)
  }
`;

export const UPDATE_ORG_MEMBER_ROLE = gql`
  mutation UpdateOrgMemberRole($userId: ID!, $organizationId: ID!, $role: OrgRole!) {
    updateOrgMemberRole(userId: $userId, organizationId: $organizationId, role: $role) {
      id
      role
    }
  }
`;

// ============================================
// Organization Mutations
// ============================================

export const CREATE_ORGANIZATION = gql`
  mutation CreateOrganization($input: CreateOrganizationInput!) {
    createOrganization(input: $input) {
      id
      name
    }
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
  mutation UpdateTeam($id: ID!, $name: String, $season: String, $sport: String, $color: String, $description: String) {
    updateTeam(id: $id, name: $name, season: $season, sport: $sport, color: $color, description: $description) {
      ...TeamFields
    }
  }
  ${TEAM_FRAGMENT}
`;

export const DELETE_TEAM = gql`
  mutation DeleteTeam($id: ID!, $hardDelete: Boolean) {
    deleteTeam(id: $id, hardDelete: $hardDelete)
  }
`;

export const RESTORE_TEAM = gql`
  mutation RestoreTeam($id: ID!) {
    restoreTeam(id: $id) {
      ...TeamFields
    }
  }
  ${TEAM_FRAGMENT}
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
// Organization Member Mutations
// ============================================

export const ADD_ORG_MEMBER = gql`
  mutation AddOrgMember($input: AddOrgMemberInput!) {
    addOrgMember(input: $input) {
      id
      role
      user {
        id
      }
      organization {
        id
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
    $endDate: String
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
      endDate: $endDate
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

export const CREATE_RECURRING_EVENT = gql`
  mutation CreateRecurringEvent($input: CreateRecurringEventInput!) {
    createRecurringEvent(input: $input) {
      id
      title
      frequency
      daysOfWeek
      startDate
      endDate
      events {
        ...EventFields
      }
    }
  }
  ${EVENT_FRAGMENT}
`;

export const DELETE_RECURRING_EVENT = gql`
  mutation DeleteRecurringEvent($id: ID!) {
    deleteRecurringEvent(id: $id)
  }
`;

// ============================================
// Invite Mutations
// ============================================

export const CREATE_INVITE = gql`
  mutation CreateInvite($input: CreateInviteInput!) {
    createInvite(input: $input) {
      ...InviteFields
    }
  }
  ${INVITE_FRAGMENT}
`;

export const ACCEPT_INVITE = gql`
  mutation AcceptInvite($token: String!) {
    acceptInvite(token: $token) {
      id
      role
      user {
        id
      }
      organization {
        id
        name
      }
    }
  }
`;

export const CANCEL_INVITE = gql`
  mutation CancelInvite($id: ID!) {
    cancelInvite(id: $id)
  }
`;

export const RESEND_INVITE = gql`
  mutation ResendInvite($id: ID!) {
    resendInvite(id: $id) {
      ...InviteFields
    }
  }
  ${INVITE_FRAGMENT}
`;

// ============================================
// Organization Leave / Transfer Mutations
// ============================================

export const LEAVE_ORGANIZATION = gql`
  mutation LeaveOrganization($organizationId: ID!) {
    leaveOrganization(organizationId: $organizationId)
  }
`;

export const TRANSFER_OWNERSHIP = gql`
  mutation TransferOwnership($organizationId: ID!, $newOwnerId: ID!) {
    transferOwnership(organizationId: $organizationId, newOwnerId: $newOwnerId)
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

export const ADMIN_CHECK_IN = gql`
  mutation AdminCheckIn($input: AdminCheckInInput!) {
    adminCheckIn(input: $input) {
      id
      status
      checkInTime
      checkOutTime
      hoursLogged
      note
    }
  }
`;

export const CHECK_OUT = gql`
  mutation CheckOut($input: CheckOutInput!) {
    checkOut(input: $input) {
      id
      checkOutTime
      hoursLogged
    }
  }
`;

export const MARK_ABSENT_FOR_PAST_EVENTS = gql`
  mutation MarkAbsentForPastEvents($organizationId: ID!) {
    markAbsentForPastEvents(organizationId: $organizationId)
  }
`;

// ============================================
// Ad-Hoc Check-In Mutations
// ============================================

export const APPROVE_AD_HOC_CHECK_IN = gql`
  mutation ApproveAdHocCheckIn($checkInId: ID!) {
    approveAdHocCheckIn(checkInId: $checkInId) {
      id
      approved
    }
  }
`;

export const DENY_AD_HOC_CHECK_IN = gql`
  mutation DenyAdHocCheckIn($checkInId: ID!) {
    denyAdHocCheckIn(checkInId: $checkInId)
  }
`;

// ============================================
// Account Mutations
// ============================================

export const DELETE_MY_ACCOUNT = gql`
  mutation DeleteMyAccount {
    deleteMyAccount
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
