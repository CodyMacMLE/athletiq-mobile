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
    dateOfBirth
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
    season
    sport
    color
    description
    memberCount
    attendancePercent(timeRange: MONTH)
    sortOrder
    archivedAt
    orgSeason {
      id
      name
      startMonth
      endMonth
    }
    seasonYear
  }
`;

export const INVITE_FRAGMENT = gql`
  fragment InviteFields on Invite {
    id
    email
    role
    teamIds
    status
    token
    createdAt
    expiresAt
  }
`;

export const EVENT_FRAGMENT = gql`
  fragment EventFields on Event {
    id
    title
    type
    date
    endDate
    startTime
    endTime
    location
    description
    venue {
      id
      name
      address
      city
    }
    recurringEvent {
      id
    }
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

export const GET_ORGANIZATION = gql`
  query GetOrganization($id: ID!) {
    organization(id: $id) {
      id
      name
      image
      memberCount
      adminHealthAccess
      coachHealthAccess
      allowCoachHourEdit
      reportFrequencies
      payrollConfig {
        payPeriod
        defaultHourlyRate
        deductions {
          id
          name
          type
          value
        }
      }
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
  query GetTeams($organizationId: ID!, $includeArchived: Boolean) {
    teams(organizationId: $organizationId, includeArchived: $includeArchived) {
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
        checkIns {
          id
          status
        }
      }
      recurringEvents {
        id
        frequency
        daysOfWeek
        startTime
        endTime
        startDate
        endDate
        venue { id name city }
        includedAthletes { id firstName lastName image }
        excludedAthletes { id firstName lastName image }
      }
    }
  }
  ${TEAM_FRAGMENT}
  ${USER_FRAGMENT}
  ${EVENT_FRAGMENT}
`;

export const GET_EVENTS = gql`
  query GetEvents($organizationId: ID!, $type: EventType, $teamId: ID, $startDate: String, $endDate: String, $limit: Int, $offset: Int) {
    events(organizationId: $organizationId, type: $type, teamId: $teamId, startDate: $startDate, endDate: $endDate, limit: $limit, offset: $offset) {
      ...EventFields
      team {
        id
        name
      }
      participatingTeams {
        id
        name
      }
      checkIns {
        id
        status
      }
      recurringEvent {
        id
      }
    }
  }
  ${EVENT_FRAGMENT}
`;

export const GET_EVENTS_COUNT = gql`
  query GetEventsCount($organizationId: ID!, $teamId: ID) {
    eventsCount(organizationId: $organizationId, teamId: $teamId) {
      PRACTICE
      MEETING
      EVENT
    }
  }
`;

export const GET_EVENT_ATTENDANCE = gql`
  query GetEventAttendance($eventId: ID!) {
    eventAttendance(eventId: $eventId) {
      id
      status
      checkInTime
      checkOutTime
      hoursLogged
      note
      user {
        ...UserFields
      }
    }
  }
  ${USER_FRAGMENT}
`;

export const GET_EVENT_UNCHECKED_ATHLETES = gql`
  query GetEventUncheckedAthletes($eventId: ID!) {
    eventUncheckedAthletes(eventId: $eventId) {
      id
      firstName
      lastName
    }
  }
`;

export const GET_PENDING_EXCUSE_REQUESTS = gql`
  query GetPendingExcuseRequests($organizationId: ID!) {
    pendingExcuseRequests(organizationId: $organizationId) {
      id
      reason
      status
      attemptCount
      createdAt
      user {
        id
        firstName
        lastName
        image
        organizationMemberships {
          role
          organization { id }
        }
      }
      event {
        ...EventFields
      }
    }
  }
  ${EVENT_FRAGMENT}
`;

export const GET_ORG_EXCUSE_REQUESTS = gql`
  query GetOrgExcuseRequests(
    $organizationId: ID!
    $status: String
    $requesterType: String
    $search: String
    $sortBy: String
    $sortDir: String
    $limit: Int
    $offset: Int
  ) {
    orgExcuseRequests(
      organizationId: $organizationId
      status: $status
      requesterType: $requesterType
      search: $search
      sortBy: $sortBy
      sortDir: $sortDir
      limit: $limit
      offset: $offset
    ) {
      total
      items {
        id
        reason
        status
        attemptCount
        createdAt
        user {
          id
          firstName
          lastName
          image
          organizationMemberships {
            role
            organization { id }
          }
        }
        event {
          id
          title
          type
          date
          startTime
          endTime
          team { id name }
        }
      }
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

export const GET_ORGANIZATION_USERS = gql`
  query GetOrganizationUsers($id: ID!) {
    organization(id: $id) {
      id
      members {
        id
        role
        athleteStatus
        user {
          ...UserFields
          memberships {
            id
            role
            team {
              id
              name
            }
          }
        }
      }
      invites {
        ...InviteFields
      }
    }
  }
  ${USER_FRAGMENT}
  ${INVITE_FRAGMENT}
`;

export const GET_INVITE = gql`
  query GetInvite($token: String!) {
    invite(token: $token) {
      ...InviteFields
      organization {
        id
        name
      }
    }
  }
  ${INVITE_FRAGMENT}
`;

export const GET_USERS = gql`
  query GetUsers {
    users {
      ...UserFields
    }
  }
  ${USER_FRAGMENT}
`;

export const GET_ATTENDANCE_LOG = gql`
  query GetAttendanceLog($organizationId: ID!, $limit: Int, $offset: Int) {
    attendanceLog(organizationId: $organizationId, limit: $limit, offset: $offset) {
      id
      status
      checkInTime
      checkOutTime
      hoursLogged
      note
      createdAt
      user {
        id
        firstName
        lastName
        image
      }
      event {
        id
        title
        date
        startTime
        endTime
      }
    }
  }
`;

export const GET_ABSENT_EXCUSED_LOG = gql`
  query GetAbsentExcusedLog($organizationId: ID!, $limit: Int, $offset: Int) {
    absentExcusedLog(organizationId: $organizationId, limit: $limit, offset: $offset) {
      id
      status
      note
      createdAt
      user {
        id
        firstName
        lastName
        image
      }
      event {
        id
        title
        date
        startTime
        endTime
      }
    }
  }
`;

export const GET_ALL_ATTENDANCE_RECORDS = gql`
  query GetAllAttendanceRecords($organizationId: ID!, $search: String, $status: AttendanceStatus, $teamId: ID, $userId: ID, $startDate: String, $endDate: String, $sortField: String, $sortDir: String, $limit: Int, $offset: Int) {
    allAttendanceRecords(organizationId: $organizationId, search: $search, status: $status, teamId: $teamId, userId: $userId, startDate: $startDate, endDate: $endDate, sortField: $sortField, sortDir: $sortDir, limit: $limit, offset: $offset) {
      id
      status
      checkInTime
      checkOutTime
      hoursLogged
      note
      createdAt
      user {
        id
        firstName
        lastName
        image
      }
      event {
        id
        title
        date
        startTime
        endTime
      }
    }
  }
`;

export const GET_ATTENDANCE_RECORDS_COUNT = gql`
  query GetAttendanceRecordsCount($organizationId: ID!, $search: String, $status: AttendanceStatus, $teamId: ID, $userId: ID, $startDate: String, $endDate: String) {
    attendanceRecordsCount(organizationId: $organizationId, search: $search, status: $status, teamId: $teamId, userId: $userId, startDate: $startDate, endDate: $endDate)
  }
`;

export const GET_EVENT_DETAIL = gql`
  query GetEventDetail($id: ID!) {
    event(id: $id) {
      ...EventFields
      team {
        id
        name
        members {
          id
          role
          joinedAt
          user {
            id
            firstName
            lastName
            image
          }
        }
      }
      participatingTeams {
        id
        name
        members {
          id
          role
          joinedAt
          user {
            id
            firstName
            lastName
            image
          }
        }
      }
      checkIns {
        id
        status
        checkInTime
        checkOutTime
        hoursLogged
        note
        user {
          ...UserFields
        }
      }
      rsvps {
        id
        status
        note
        user {
          id
          firstName
          lastName
        }
      }
      includedAthletes {
        id
        firstName
        lastName
        image
      }
      excludedAthletes {
        id
        firstName
        lastName
        image
      }
    }
  }
  ${EVENT_FRAGMENT}
  ${USER_FRAGMENT}
`;

export const GET_ATTENDANCE_INSIGHTS = gql`
  query GetAttendanceInsights($organizationId: ID!, $timeRange: TimeRange) {
    attendanceInsights(organizationId: $organizationId, timeRange: $timeRange) {
      totalExpected
      onTimeCount
      lateCount
      absentCount
      excusedCount
      attendanceRate
      eventCount
    }
  }
`;

export const GET_USER_STATS = gql`
  query GetUserStats($userId: ID!, $organizationId: ID!, $teamId: ID, $timeRange: TimeRange) {
    userStats(userId: $userId, organizationId: $organizationId, teamId: $teamId, timeRange: $timeRange) {
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

export const GET_USER_BADGES = gql`
  query GetUserBadges($userId: ID!, $organizationId: ID!) {
    getUserBadges(userId: $userId, organizationId: $organizationId) {
      totalEarned
      badges {
        id
        name
        description
        category
        icon
        earned
        progress
        threshold
      }
    }
  }
`;

export const GET_CHECK_IN_HISTORY = gql`
  query GetCheckInHistory($userId: ID!, $limit: Int) {
    checkInHistory(userId: $userId, limit: $limit) {
      id
      status
      checkInTime
      checkOutTime
      hoursLogged
      note
      createdAt
      event {
        id
        title
        date
        startTime
        endTime
      }
    }
  }
`;

// ============================================
// Season Queries
// ============================================

export const GET_ORG_SEASONS = gql`
  query GetOrgSeasons($organizationId: ID!) {
    orgSeasons(organizationId: $organizationId) {
      id
      name
      startMonth
      endMonth
      organizationId
      createdAt
      updatedAt
    }
  }
`;

// ============================================
// Ad-Hoc Check-In Queries
// ============================================

export const GET_USER_HEALTH = gql`
  query GetUserHealth($userId: ID!, $organizationId: ID!) {
    user(id: $userId) {
      id
      emergencyContacts(organizationId: $organizationId) {
        id
        name
        relationship
        phone
        email
        isPrimary
      }
      medicalInfo(organizationId: $organizationId) {
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
    organization(id: $organizationId) {
      id
      adminHealthAccess
      coachHealthAccess
    }
  }
`;

export const GET_ATHLETE_GUARDIANS = gql`
  query GetAthleteGuardians($userId: ID!, $organizationId: ID!) {
    athleteGuardians(userId: $userId, organizationId: $organizationId) {
      id
      createdAt
      guardian {
        id
        firstName
        lastName
        email
        phone
        image
      }
    }
  }
`;

export const GET_GUARDIAN_ATHLETES = gql`
  query GetGuardianAthletes($organizationId: ID!) {
    myLinkedAthletes(organizationId: $organizationId) {
      id
      athlete {
        id
        firstName
        lastName
        image
        memberships {
          id
          role
          team {
            id
            name
          }
        }
      }
    }
  }
`;

// ============================================
// Venue Queries
// ============================================

export const GET_ORGANIZATION_VENUES = gql`
  query GetOrganizationVenues($organizationId: ID!) {
    organizationVenues(organizationId: $organizationId) {
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

export const EXPORT_CALENDAR = gql`
  query ExportCalendar($organizationId: ID!, $teamId: ID, $startDate: String, $endDate: String) {
    exportCalendar(organizationId: $organizationId, teamId: $teamId, startDate: $startDate, endDate: $endDate)
  }
`;

export const GET_ATHLETE_STATUS_HISTORY = gql`
  query GetAthleteStatusHistory($userId: ID!, $organizationId: ID!) {
    athleteStatusHistory(userId: $userId, organizationId: $organizationId) {
      id
      status
      note
      createdAt
      changedByUser {
        id
        firstName
        lastName
      }
    }
  }
`;

export const GET_GYMNASTICS_PROFILE = gql`
  query GetGymnasticsProfile($userId: ID!, $organizationId: ID!) {
    gymnasticsProfile(userId: $userId, organizationId: $organizationId) {
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

export const GET_PENDING_AD_HOC_CHECK_INS = gql`
  query GetPendingAdHocCheckIns($organizationId: ID!) {
    pendingAdHocCheckIns(organizationId: $organizationId) {
      id
      status
      checkInTime
      note
      isAdHoc
      approved
      createdAt
      user {
        id
        firstName
        lastName
        image
      }
      event {
        id
        title
        type
        date
        team {
          id
          name
        }
      }
    }
  }
`;

export const GET_ORG_COACH_HOURS = gql`
  query OrgCoachHours($organizationId: ID!, $month: Int!, $year: Int!) {
    orgCoachHours(organizationId: $organizationId, month: $month, year: $year) {
      month
      year
      coaches {
        userId
        totalHours
        totalPay
        grossPay
        netPay
        hourlyRate
        salaryAmount
        appliedDeductions {
          name
          type
          value
          amount
        }
        user {
          id
          firstName
          lastName
          image
        }
        entries {
          hoursLogged
          event {
            id
            title
            date
            startTime
            endTime
          }
          checkIn {
            id
            checkInTime
            checkOutTime
            status
          }
        }
      }
    }
  }
`;
