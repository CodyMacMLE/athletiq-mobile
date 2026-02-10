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
  mutation NfcCheckIn($token: String!) {
    nfcCheckIn(token: $token) {
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
