import { gql } from "@apollo/client";
import { USER_FRAGMENT, EVENT_FRAGMENT, CHECKIN_FRAGMENT } from "./queries";

// ============================================
// User Mutations
// ============================================

export const UPDATE_USER = gql`
  mutation UpdateUser($id: ID!, $input: UpdateUserInput!) {
    updateUser(id: $id, input: $input) {
      ...UserFields
    }
  }
  ${USER_FRAGMENT}
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
// Check-in Mutations
// ============================================

export const CHECK_IN = gql`
  mutation CheckIn($input: CheckInInput!) {
    checkIn(input: $input) {
      ...CheckInFields
    }
  }
  ${CHECKIN_FRAGMENT}
`;

export const CHECK_OUT = gql`
  mutation CheckOut($input: CheckOutInput!) {
    checkOut(input: $input) {
      ...CheckInFields
    }
  }
  ${CHECKIN_FRAGMENT}
`;

// ============================================
// Excuse Mutations
// ============================================

export const CREATE_EXCUSE_REQUEST = gql`
  mutation CreateExcuseRequest($input: CreateExcuseRequestInput!) {
    createExcuseRequest(input: $input) {
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

export const CANCEL_EXCUSE_REQUEST = gql`
  mutation CancelExcuseRequest($id: ID!) {
    cancelExcuseRequest(id: $id)
  }
`;

// ============================================
// NFC Mutations
// ============================================

export const NFC_CHECK_IN = gql`
  mutation NfcCheckIn($token: String!, $forUserId: ID) {
    nfcCheckIn(token: $token, forUserId: $forUserId) {
      checkIn {
        ...CheckInFields
      }
      action
      event {
        ...EventFields
      }
    }
  }
  ${CHECKIN_FRAGMENT}
`;

export const REGISTER_NFC_TAG = gql`
  mutation RegisterNfcTag($input: RegisterNfcTagInput!) {
    registerNfcTag(input: $input) {
      id
      token
      name
      isActive
      createdBy
      createdAt
    }
  }
`;

export const DEACTIVATE_NFC_TAG = gql`
  mutation DeactivateNfcTag($id: ID!) {
    deactivateNfcTag(id: $id) {
      id
      isActive
    }
  }
`;

export const AD_HOC_NFC_CHECK_IN = gql`
  mutation AdHocNfcCheckIn($input: AdHocNfcCheckInInput!) {
    adHocNfcCheckIn(input: $input) {
      checkIn {
        ...CheckInFields
      }
      action
      event {
        ...EventFields
      }
    }
  }
  ${CHECKIN_FRAGMENT}
`;

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
  mutation InviteGuardian($email: String!, $organizationId: ID!) {
    inviteGuardian(email: $email, organizationId: $organizationId) {
      id
      email
      status
    }
  }
`;

export const REMOVE_GUARDIAN = gql`
  mutation RemoveGuardian($guardianLinkId: ID!) {
    removeGuardian(guardianLinkId: $guardianLinkId)
  }
`;

export const ACCEPT_INVITE = gql`
  mutation AcceptInvite($token: String!) {
    acceptInvite(token: $token) {
      id
      role
      organization {
        id
        name
      }
    }
  }
`;

// ============================================
// Feedback Mutations
// ============================================

export const SUBMIT_FEEDBACK = gql`
  mutation SubmitFeedback($input: SubmitFeedbackInput!) {
    submitFeedback(input: $input)
  }
`;
