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

export const REORDER_TEAMS = gql`
  mutation ReorderTeams($organizationId: ID!, $teamIds: [ID!]!) {
    reorderTeams(organizationId: $organizationId, teamIds: $teamIds)
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
      includedAthletes { id firstName lastName image }
      excludedAthletes { id firstName lastName image }
      events {
        ...EventFields
      }
    }
  }
  ${EVENT_FRAGMENT}
`;

export const DELETE_RECURRING_EVENT = gql`
  mutation DeleteRecurringEvent($id: ID!, $futureOnly: Boolean) {
    deleteRecurringEvent(id: $id, futureOnly: $futureOnly)
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

export const DELETE_CHECK_IN = gql`
  mutation DeleteCheckIn($userId: ID!, $eventId: ID!) {
    deleteCheckIn(userId: $userId, eventId: $eventId)
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
  mutation UpdateOrganizationSettings($id: ID!, $adminHealthAccess: AdminHealthAccess, $coachHealthAccess: CoachHealthAccess, $allowCoachHourEdit: Boolean, $reportFrequencies: [String!]) {
    updateOrganizationSettings(id: $id, adminHealthAccess: $adminHealthAccess, coachHealthAccess: $coachHealthAccess, allowCoachHourEdit: $allowCoachHourEdit, reportFrequencies: $reportFrequencies) {
      id
      adminHealthAccess
      coachHealthAccess
      allowCoachHourEdit
      reportFrequencies
    }
  }
`;

export const UPDATE_CHECK_IN_TIMES = gql`
  mutation UpdateCheckInTimes($checkInId: ID!, $checkInTime: String, $checkOutTime: String) {
    updateCheckInTimes(checkInId: $checkInId, checkInTime: $checkInTime, checkOutTime: $checkOutTime) {
      id
      checkInTime
      checkOutTime
      hoursLogged
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
// Recurring Event Athlete Include / Exclude Mutations
// ============================================

export const ADD_ATHLETE_TO_RECURRING_EVENT = gql`
  mutation AddAthleteToRecurringEvent($recurringEventId: ID!, $userId: ID!) {
    addAthleteToRecurringEvent(recurringEventId: $recurringEventId, userId: $userId) {
      id
      includedAthletes { id firstName lastName image }
      excludedAthletes { id firstName lastName image }
    }
  }
`;

export const REMOVE_ATHLETE_FROM_RECURRING_EVENT = gql`
  mutation RemoveAthleteFromRecurringEvent($recurringEventId: ID!, $userId: ID!) {
    removeAthleteFromRecurringEvent(recurringEventId: $recurringEventId, userId: $userId) {
      id
      includedAthletes { id firstName lastName image }
      excludedAthletes { id firstName lastName image }
    }
  }
`;

export const EXCLUDE_ATHLETE_FROM_RECURRING_EVENT = gql`
  mutation ExcludeAthleteFromRecurringEvent($recurringEventId: ID!, $userId: ID!) {
    excludeAthleteFromRecurringEvent(recurringEventId: $recurringEventId, userId: $userId) {
      id
      includedAthletes { id firstName lastName image }
      excludedAthletes { id firstName lastName image }
    }
  }
`;

export const UNEXCLUDE_ATHLETE_FROM_RECURRING_EVENT = gql`
  mutation UnexcludeAthleteFromRecurringEvent($recurringEventId: ID!, $userId: ID!) {
    unexcludeAthleteFromRecurringEvent(recurringEventId: $recurringEventId, userId: $userId) {
      id
      includedAthletes { id firstName lastName image }
      excludedAthletes { id firstName lastName image }
    }
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

// ============================================
// Athlete Status & Profile Mutations
// ============================================

export const UPDATE_ATHLETE_STATUS = gql`
  mutation UpdateAthleteStatus($userId: ID!, $organizationId: ID!, $status: AthleteStatus!, $note: String) {
    updateAthleteStatus(userId: $userId, organizationId: $organizationId, status: $status, note: $note) {
      id
      athleteStatus
    }
  }
`;

export const UPSERT_GYMNASTICS_PROFILE = gql`
  mutation UpsertGymnasticsProfile($userId: ID!, $organizationId: ID!, $level: String, $discipline: String, $apparatus: [String!], $notes: String) {
    upsertGymnasticsProfile(userId: $userId, organizationId: $organizationId, level: $level, discipline: $discipline, apparatus: $apparatus, notes: $notes) {
      id
      userId
      organizationId
      level
      discipline
      apparatus
      notes
      updatedAt
    }
  }
`;

export const UPDATE_PAYROLL_CONFIG = gql`
  mutation UpdatePayrollConfig($organizationId: ID!, $payPeriod: String, $defaultHourlyRate: Float, $deductions: [PayrollDeductionInput!]) {
    updatePayrollConfig(organizationId: $organizationId, payPeriod: $payPeriod, defaultHourlyRate: $defaultHourlyRate, deductions: $deductions) {
      id
      payrollConfig {
        payPeriod
        defaultHourlyRate
        deductions { id name type value }
      }
    }
  }
`;

export const UPDATE_COACH_PAY_RATE = gql`
  mutation UpdateCoachPayRate($organizationId: ID!, $userId: ID!, $hourlyRate: Float, $salaryAmount: Float) {
    updateCoachPayRate(organizationId: $organizationId, userId: $userId, hourlyRate: $hourlyRate, salaryAmount: $salaryAmount) {
      id
      hourlyRate
      salaryAmount
      user { id firstName lastName }
    }
  }
`;

export const UPDATE_COACH_HOURLY_RATE = gql`
  mutation UpdateCoachHourlyRate($organizationId: ID!, $userId: ID!, $hourlyRate: Float) {
    updateCoachHourlyRate(organizationId: $organizationId, userId: $userId, hourlyRate: $hourlyRate) {
      id
      hourlyRate
      user {
        id
        firstName
        lastName
      }
    }
  }
`;

export const CREATE_CUSTOM_ROLE = gql`
  mutation CreateCustomRole(
    $organizationId: ID!
    $name: String!
    $description: String
    $canEditEvents: Boolean
    $canApproveExcuses: Boolean
    $canViewAnalytics: Boolean
    $canManageMembers: Boolean
    $canManageTeams: Boolean
    $canManagePayments: Boolean
  ) {
    createCustomRole(
      organizationId: $organizationId
      name: $name
      description: $description
      canEditEvents: $canEditEvents
      canApproveExcuses: $canApproveExcuses
      canViewAnalytics: $canViewAnalytics
      canManageMembers: $canManageMembers
      canManageTeams: $canManageTeams
      canManagePayments: $canManagePayments
    ) {
      id
      name
      description
      canEditEvents
      canApproveExcuses
      canViewAnalytics
      canManageMembers
      canManageTeams
      canManagePayments
    }
  }
`;

export const UPDATE_CUSTOM_ROLE = gql`
  mutation UpdateCustomRole(
    $id: ID!
    $name: String
    $description: String
    $canEditEvents: Boolean
    $canApproveExcuses: Boolean
    $canViewAnalytics: Boolean
    $canManageMembers: Boolean
    $canManageTeams: Boolean
    $canManagePayments: Boolean
  ) {
    updateCustomRole(
      id: $id
      name: $name
      description: $description
      canEditEvents: $canEditEvents
      canApproveExcuses: $canApproveExcuses
      canViewAnalytics: $canViewAnalytics
      canManageMembers: $canManageMembers
      canManageTeams: $canManageTeams
      canManagePayments: $canManagePayments
    ) {
      id
      name
      description
      canEditEvents
      canApproveExcuses
      canViewAnalytics
      canManageMembers
      canManageTeams
      canManagePayments
    }
  }
`;

export const DELETE_CUSTOM_ROLE = gql`
  mutation DeleteCustomRole($id: ID!) {
    deleteCustomRole(id: $id)
  }
`;

export const ASSIGN_CUSTOM_ROLE = gql`
  mutation AssignCustomRole($memberId: ID!, $customRoleId: ID) {
    assignCustomRole(memberId: $memberId, customRoleId: $customRoleId) {
      id
      role
      customRole {
        id
        name
      }
      user {
        id
        firstName
        lastName
      }
    }
  }
`;

export const CREATE_TEAM_CHALLENGE = gql`
  mutation CreateTeamChallenge(
    $teamId: ID!
    $organizationId: ID!
    $title: String!
    $description: String
    $targetPercent: Float!
    $startDate: String!
    $endDate: String!
  ) {
    createTeamChallenge(
      teamId: $teamId
      organizationId: $organizationId
      title: $title
      description: $description
      targetPercent: $targetPercent
      startDate: $startDate
      endDate: $endDate
    ) {
      id
      title
      description
      targetPercent
      startDate
      endDate
      currentPercent
      completedAt
    }
  }
`;

export const DELETE_TEAM_CHALLENGE = gql`
  mutation DeleteTeamChallenge($id: ID!) {
    deleteTeamChallenge(id: $id)
  }
`;

export const CREATE_ATHLETE_RECOGNITION = gql`
  mutation CreateAthleteRecognition(
    $userId: ID!
    $teamId: ID!
    $organizationId: ID!
    $periodType: String!
    $note: String
  ) {
    createAthleteRecognition(
      userId: $userId
      teamId: $teamId
      organizationId: $organizationId
      periodType: $periodType
      note: $note
    ) {
      id
      period
      periodType
      note
      createdAt
      user {
        id
        firstName
        lastName
        image
      }
      nominatedBy {
        id
        firstName
        lastName
      }
    }
  }
`;

export const DELETE_ATHLETE_RECOGNITION = gql`
  mutation DeleteAthleteRecognition($id: ID!) {
    deleteAthleteRecognition(id: $id)
  }
`;

// ============================================
// Payments (#27)
// ============================================

export const CREATE_INVOICE = gql`
  mutation CreateInvoice(
    $organizationId: ID!
    $userId: ID!
    $title: String!
    $description: String
    $amountCents: Int!
    $currency: String
    $dueDate: String
  ) {
    createInvoice(
      organizationId: $organizationId
      userId: $userId
      title: $title
      description: $description
      amountCents: $amountCents
      currency: $currency
      dueDate: $dueDate
    ) {
      id
      title
      amountCents
      status
      totalPaidCents
      balanceCents
      createdAt
    }
  }
`;

export const UPDATE_INVOICE = gql`
  mutation UpdateInvoice($id: ID!, $title: String, $description: String, $amountCents: Int, $dueDate: String, $status: InvoiceStatus) {
    updateInvoice(id: $id, title: $title, description: $description, amountCents: $amountCents, dueDate: $dueDate, status: $status) {
      id
      title
      amountCents
      dueDate
      status
      totalPaidCents
      balanceCents
      updatedAt
    }
  }
`;

export const DELETE_INVOICE = gql`
  mutation DeleteInvoice($id: ID!) {
    deleteInvoice(id: $id)
  }
`;

export const SEND_INVOICE = gql`
  mutation SendInvoice($id: ID!) {
    sendInvoice(id: $id) {
      id
      status
      sentAt
    }
  }
`;

export const RECORD_PAYMENT = gql`
  mutation RecordPayment($invoiceId: ID!, $amountCents: Int!, $method: PaymentMethod, $note: String, $paidAt: String) {
    recordPayment(invoiceId: $invoiceId, amountCents: $amountCents, method: $method, note: $note, paidAt: $paidAt) {
      id
      amountCents
      method
      paidAt
    }
  }
`;

export const SEND_PAYMENT_REMINDER = gql`
  mutation SendPaymentReminder($invoiceId: ID!) {
    sendPaymentReminder(invoiceId: $invoiceId)
  }
`;

export const CREATE_STRIPE_CONNECT_LINK = gql`
  mutation CreateStripeConnectLink($organizationId: ID!) {
    createStripeConnectLink(organizationId: $organizationId)
  }
`;

export const DISCONNECT_STRIPE_ACCOUNT = gql`
  mutation DisconnectStripeAccount($organizationId: ID!) {
    disconnectStripeAccount(organizationId: $organizationId)
  }
`;
