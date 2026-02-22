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
  mutation UpdateTeam($id: ID!, $name: String, $season: String, $sport: String, $color: String, $description: String, $orgSeasonId: ID, $seasonYear: Int) {
    updateTeam(id: $id, name: $name, season: $season, sport: $sport, color: $color, description: $description, orgSeasonId: $orgSeasonId, seasonYear: $seasonYear) {
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
// Season Mutations
// ============================================

export const CREATE_ORG_SEASON = gql`
  mutation CreateOrgSeason($input: CreateOrgSeasonInput!) {
    createOrgSeason(input: $input) {
      id
      name
      startMonth
      endMonth
      organizationId
    }
  }
`;

export const UPDATE_ORG_SEASON = gql`
  mutation UpdateOrgSeason($id: ID!, $name: String, $startMonth: Int, $endMonth: Int) {
    updateOrgSeason(id: $id, name: $name, startMonth: $startMonth, endMonth: $endMonth) {
      id
      name
      startMonth
      endMonth
    }
  }
`;

export const DELETE_ORG_SEASON = gql`
  mutation DeleteOrgSeason($id: ID!) {
    deleteOrgSeason(id: $id)
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
    $venueId: ID
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
      venueId: $venueId
    ) {
      ...EventFields
      venue {
        id
        name
        address
        city
      }
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
// Guardian Mutations
// ============================================

export const INVITE_GUARDIAN = gql`
  mutation InviteGuardian($email: String!, $organizationId: ID!, $athleteId: ID) {
    inviteGuardian(email: $email, organizationId: $organizationId, athleteId: $athleteId) {
      id
      email
      status
      token
    }
  }
`;

export const REMOVE_GUARDIAN = gql`
  mutation RemoveGuardian($guardianLinkId: ID!) {
    removeGuardian(guardianLinkId: $guardianLinkId)
  }
`;

// ============================================
// Upload Mutations
// ============================================

export const GENERATE_UPLOAD_URL = gql`
  mutation GenerateUploadUrl($fileType: String!) {
    generateUploadUrl(fileType: $fileType) {
      uploadUrl
      publicUrl
    }
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

// ============================================
// Health & Safety Mutations
// ============================================

export const CREATE_EMERGENCY_CONTACT = gql`
  mutation CreateEmergencyContact($input: CreateEmergencyContactInput!) {
    createEmergencyContact(input: $input) {
      id
      name
      relationship
      phone
      email
      isPrimary
    }
  }
`;

export const UPDATE_EMERGENCY_CONTACT = gql`
  mutation UpdateEmergencyContact($id: ID!, $input: UpdateEmergencyContactInput!) {
    updateEmergencyContact(id: $id, input: $input) {
      id
      name
      relationship
      phone
      email
      isPrimary
    }
  }
`;

export const DELETE_EMERGENCY_CONTACT = gql`
  mutation DeleteEmergencyContact($id: ID!) {
    deleteEmergencyContact(id: $id)
  }
`;

export const UPSERT_MEDICAL_INFO = gql`
  mutation UpsertMedicalInfo($input: UpsertMedicalInfoInput!) {
    upsertMedicalInfo(input: $input) {
      id
      conditions
      allergies
      medications
      insuranceProvider
      insurancePolicyNumber
      insuranceGroupNumber
      notes
      updatedAt
    }
  }
`;

export const UPDATE_ORGANIZATION_SETTINGS = gql`
  mutation UpdateOrganizationSettings($id: ID!, $adminHealthAccess: AdminHealthAccess, $coachHealthAccess: CoachHealthAccess) {
    updateOrganizationSettings(id: $id, adminHealthAccess: $adminHealthAccess, coachHealthAccess: $coachHealthAccess) {
      id
      adminHealthAccess
      coachHealthAccess
    }
  }
`;

// ============================================
// Venue Mutations
// ============================================

export const CREATE_VENUE = gql`
  mutation CreateVenue($input: CreateVenueInput!) {
    createVenue(input: $input) {
      id
      name
      address
      city
      state
      country
      notes
    }
  }
`;

export const UPDATE_VENUE = gql`
  mutation UpdateVenue($id: ID!, $input: UpdateVenueInput!) {
    updateVenue(id: $id, input: $input) {
      id
      name
      address
      city
      state
      country
      notes
    }
  }
`;

export const DELETE_VENUE = gql`
  mutation DeleteVenue($id: ID!) {
    deleteVenue(id: $id)
  }
`;

// ============================================
// Athlete Include / Exclude Mutations
// ============================================

export const ADD_ATHLETE_TO_EVENT = gql`
  mutation AddAthleteToEvent($eventId: ID!, $userId: ID!) {
    addAthleteToEvent(eventId: $eventId, userId: $userId) {
      id
      includedAthletes { id firstName lastName image }
      excludedAthletes { id firstName lastName image }
    }
  }
`;

export const REMOVE_ATHLETE_FROM_EVENT = gql`
  mutation RemoveAthleteFromEvent($eventId: ID!, $userId: ID!) {
    removeAthleteFromEvent(eventId: $eventId, userId: $userId) {
      id
      includedAthletes { id firstName lastName image }
      excludedAthletes { id firstName lastName image }
    }
  }
`;

export const EXCLUDE_ATHLETE_FROM_EVENT = gql`
  mutation ExcludeAthleteFromEvent($eventId: ID!, $userId: ID!) {
    excludeAthleteFromEvent(eventId: $eventId, userId: $userId) {
      id
      includedAthletes { id firstName lastName image }
      excludedAthletes { id firstName lastName image }
    }
  }
`;

export const UNEXCLUDE_ATHLETE_FROM_EVENT = gql`
  mutation UnexcludeAthleteFromEvent($eventId: ID!, $userId: ID!) {
    unexcludeAthleteFromEvent(eventId: $eventId, userId: $userId) {
      id
      includedAthletes { id firstName lastName image }
      excludedAthletes { id firstName lastName image }
    }
  }
`;
