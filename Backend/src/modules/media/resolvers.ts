import { prisma } from "../../db.js";
import { AttendanceStatus } from "@prisma/client";
import { generateProfilePictureUploadUrl } from "../../s3.js";
import { parseTimeString } from "../../utils/time.js";
import { toISO } from "../../utils/time.js";
import type { Loaders } from "../../utils/dataLoaders.js";

interface Context {
  userId?: string;
  loaders: Loaders;
}

export const mediaResolvers = {
  Query: {
    organizationNfcTags: async (_: unknown, { organizationId }: { organizationId: string }) => {
      return prisma.nfcTag.findMany({ where: { organizationId, isActive: true } });
    },

    pendingAdHocCheckIns: async (
      _: unknown,
      { organizationId }: { organizationId: string },
      context: { userId?: string }
    ) => {
      if (!context.userId) throw new Error("Authentication required");
      const orgMembership = await prisma.organizationMember.findUnique({
        where: { userId_organizationId: { userId: context.userId, organizationId } },
      });
      if (!orgMembership || !["OWNER", "ADMIN", "MANAGER", "COACH"].includes(orgMembership.role)) {
        throw new Error("Only owners, admins, managers, or coaches can view pending check-ins");
      }

      // OWNER/ADMIN/MANAGER see all pending; COACH only sees teams they coach
      if (orgMembership.role === "COACH") {
        const coachedTeams = await prisma.teamMember.findMany({
          where: { userId: context.userId, role: { in: ["COACH", "ADMIN"] }, team: { organizationId } },
          select: { teamId: true },
        });
        const coachedTeamIds = coachedTeams.map((t) => t.teamId);
        return prisma.checkIn.findMany({
          where: { isAdHoc: true, approved: false, event: { organizationId, teamId: { in: coachedTeamIds } } },
          orderBy: { createdAt: "desc" },
        });
      }

      return prisma.checkIn.findMany({
        where: { isAdHoc: true, approved: false, event: { organizationId } },
        orderBy: { createdAt: "desc" },
      });
    },
  },

  Mutation: {
    generateUploadUrl: async (
      _: unknown,
      { fileType }: { fileType: string },
      context: { userId?: string }
    ) => {
      if (!context.userId) throw new Error("Authentication required");
      return generateProfilePictureUploadUrl(context.userId, fileType);
    },

    registerNfcTag: async (
      _: unknown,
      { input }: { input: { token: string; name: string; organizationId: string } },
      context: { userId?: string }
    ) => {
      if (!context.userId) throw new Error("Authentication required");

      // Verify caller is OWNER or MANAGER of the org
      const membership = await prisma.organizationMember.findUnique({
        where: { userId_organizationId: { userId: context.userId, organizationId: input.organizationId } },
      });
      if (!membership || !["OWNER", "ADMIN", "MANAGER"].includes(membership.role)) {
        throw new Error("Only owners, admins, and managers can register NFC tags");
      }

      // Check for duplicate token
      const existing = await prisma.nfcTag.findUnique({ where: { token: input.token } });
      if (existing) throw new Error("A tag with this token already exists");

      return prisma.nfcTag.create({
        data: {
          token: input.token,
          name: input.name,
          organizationId: input.organizationId,
          createdBy: context.userId,
        },
      });
    },

    deactivateNfcTag: async (
      _: unknown,
      { id }: { id: string },
      context: { userId?: string }
    ) => {
      if (!context.userId) throw new Error("Authentication required");

      const tag = await prisma.nfcTag.findUnique({ where: { id } });
      if (!tag) throw new Error("NFC tag not found");

      // Verify caller is OWNER or MANAGER of the tag's org
      const membership = await prisma.organizationMember.findUnique({
        where: { userId_organizationId: { userId: context.userId, organizationId: tag.organizationId } },
      });
      if (!membership || !["OWNER", "ADMIN", "MANAGER"].includes(membership.role)) {
        throw new Error("Only owners, admins, and managers can deactivate NFC tags");
      }

      return prisma.nfcTag.update({ where: { id }, data: { isActive: false } });
    },

    nfcCheckIn: async (
      _: unknown,
      { token, forUserId, teamId, bypassEarlyCheck }: { token: string; forUserId?: string; teamId?: string; bypassEarlyCheck?: boolean },
      context: { userId?: string }
    ) => {
      if (!context.userId) throw new Error("Authentication required");

      // 1. Validate tag
      const tag = await prisma.nfcTag.findUnique({ where: { token } });
      if (!tag) throw new Error("Unrecognized tag");
      if (!tag.isActive) throw new Error("Tag deactivated");

      // 2. Verify user is org member
      const orgMembership = await prisma.organizationMember.findUnique({
        where: { userId_organizationId: { userId: context.userId, organizationId: tag.organizationId } },
      });
      if (!orgMembership) throw new Error("You are not a member of this organization");

      // 3. Determine target user (self or forUserId)
      let targetUserId = context.userId;
      if (forUserId && forUserId !== context.userId) {
        // Must be a guardian link
        const guardianLink = await prisma.guardianLink.findFirst({
          where: { guardianId: context.userId, athleteId: forUserId },
        });
        if (!guardianLink) throw new Error("Not authorized to check in this user");
        targetUserId = forUserId;
      }

      // 3b. Resolve team memberships for the target user
      let teamIds: string[];
      if (teamId) {
        const teamMembership = await prisma.teamMember.findFirst({
          where: { userId: targetUserId, teamId },
          select: { teamId: true },
        });
        if (!teamMembership) {
          // Allow org-level elevated roles (owner/admin/manager/coach) to check in to any team
          const elevatedRoles = ["OWNER", "ADMIN", "MANAGER", "COACH"];
          if (!elevatedRoles.includes(orgMembership.role)) {
            throw new Error("You are not a member of this team");
          }
        }
        teamIds = [teamId];
      } else {
        const teamMemberships = await prisma.teamMember.findMany({
          where: { userId: targetUserId, team: { organizationId: tag.organizationId } },
          select: { teamId: true },
        });
        teamIds = teamMemberships.map((m) => m.teamId);
      }

      // 4. Find today's events matching those teams
      const now = new Date();
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(now);
      todayEnd.setHours(23, 59, 59, 999);

      const todaysEvents = await prisma.event.findMany({
        where: {
          organizationId: tag.organizationId,
          date: { gte: todayStart, lte: todayEnd },
          OR: [
            { teamId: { in: teamIds } },
            { participatingTeams: { some: { id: { in: teamIds } } } },
            { teamId: null }, // org-wide events
          ],
        },
        orderBy: { date: "asc" },
      });

      if (todaysEvents.length === 0) throw new Error("No events today");

      // Pre-fetch user's check-ins for today's events to skip already-checked-out ones
      const todayCheckIns = await prisma.checkIn.findMany({
        where: {
          userId: targetUserId,
          eventId: { in: todaysEvents.map((e) => e.id) },
        },
      });
      const checkedOutEventIds = new Set(
        todayCheckIns.filter((ci) => ci.checkOutTime !== null).map((ci) => ci.eventId)
      );

      // Find event in check-in window (30 min before start to event end)
      const CHECK_IN_WINDOW_MINUTES = 30;
      let selectedEvent = null;

      for (const event of todaysEvents) {
        if (checkedOutEventIds.has(event.id)) continue;

        const eventDate = new Date(event.date);
        const start = parseTimeString(event.startTime);
        const end = parseTimeString(event.endTime);

        const eventStart = new Date(eventDate);
        eventStart.setHours(start.hours, start.minutes, 0, 0);
        const windowStart = new Date(eventStart.getTime() - CHECK_IN_WINDOW_MINUTES * 60 * 1000);

        const eventEnd = new Date(eventDate);
        eventEnd.setHours(end.hours, end.minutes, 0, 0);

        if (now >= windowStart && now <= eventEnd) {
          selectedEvent = event;
          break;
        }
      }

      // If no event in window, find the next upcoming event
      if (!selectedEvent) {
        for (const event of todaysEvents) {
          if (checkedOutEventIds.has(event.id)) continue;
          const eventDate = new Date(event.date);
          const start = parseTimeString(event.startTime);
          const eventStart = new Date(eventDate);
          eventStart.setHours(start.hours, start.minutes, 0, 0);
          if (eventStart > now) {
            if (bypassEarlyCheck) {
              // User confirmed early check-in — proceed with this event
              selectedEvent = event;
              break;
            }
            throw new Error(`TOO_EARLY:${event.title}:${event.startTime}`);
          }
        }
        // All remaining events already ended (or bypass still left selectedEvent null)
        if (!selectedEvent) throw new Error("No events today");
      }

      // 5. Toggle logic
      const existingCheckIn = await prisma.checkIn.findUnique({
        where: { userId_eventId: { userId: targetUserId, eventId: selectedEvent.id } },
      });

      if (existingCheckIn) {
        if (existingCheckIn.checkOutTime) {
          throw new Error("Already checked out");
        }
        // Check out — use event start time as effective start if checked in early
        if (!existingCheckIn.checkInTime) throw new Error("No check-in time recorded");
        let effectiveStart = existingCheckIn.checkInTime;
        {
          const evDate = new Date(selectedEvent.date);
          const evTime = parseTimeString(selectedEvent.startTime);
          const evStart = new Date(evDate);
          evStart.setHours(evTime.hours, evTime.minutes, 0, 0);
          if (existingCheckIn.checkInTime < evStart) {
            effectiveStart = evStart;
          }
        }
        const hoursLogged = Math.max(0, (now.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60));
        const updatedCheckIn = await prisma.checkIn.update({
          where: { id: existingCheckIn.id },
          data: {
            checkOutTime: now,
            hoursLogged: Math.round(hoursLogged * 100) / 100,
          },
        });
        return { checkIn: updatedCheckIn, action: "CHECKED_OUT", event: selectedEvent };
      }

      // Check in — determine ON_TIME vs LATE (on-time = before start, late = after start)
      const eventDate = new Date(selectedEvent.date);
      const { hours, minutes } = parseTimeString(selectedEvent.startTime);
      const eventStart = new Date(eventDate);
      eventStart.setHours(hours, minutes, 0, 0);
      const status: AttendanceStatus = now.getTime() <= eventStart.getTime() ? "ON_TIME" : "LATE";

      const newCheckIn = await prisma.checkIn.create({
        data: {
          userId: targetUserId,
          eventId: selectedEvent.id,
          status,
          checkInTime: now,
        },
      });
      return { checkIn: newCheckIn, action: "CHECKED_IN", event: selectedEvent };
    },

    adHocNfcCheckIn: async (
      _: unknown,
      { input }: { input: { token: string; teamId: string; startTime: string; endTime: string; note?: string } },
      context: { userId?: string }
    ) => {
      if (!context.userId) throw new Error("Authentication required");

      // Validate NFC tag
      const tag = await prisma.nfcTag.findUnique({ where: { token: input.token } });
      if (!tag) throw new Error("Unrecognized tag");
      if (!tag.isActive) throw new Error("Tag deactivated");

      // Verify user is org member
      const orgMembership = await prisma.organizationMember.findUnique({
        where: { userId_organizationId: { userId: context.userId, organizationId: tag.organizationId } },
      });
      if (!orgMembership) throw new Error("You are not a member of this organization");

      // Verify user is member of specified team
      const teamMembership = await prisma.teamMember.findUnique({
        where: { userId_teamId: { userId: context.userId, teamId: input.teamId } },
      });
      if (!teamMembership) throw new Error("You are not a member of this team");

      // Verify team belongs to the org
      const team = await prisma.team.findUnique({ where: { id: input.teamId } });
      if (!team || team.organizationId !== tag.organizationId) {
        throw new Error("Team does not belong to this organization");
      }

      // Create ad-hoc event for today
      const now = new Date();
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);

      const adHocEvent = await prisma.event.create({
        data: {
          title: "Ad-Hoc Check-In",
          type: "PRACTICE",
          date: todayStart,
          startTime: input.startTime,
          endTime: input.endTime,
          organizationId: tag.organizationId,
          teamId: input.teamId,
          isAdHoc: true,
        },
      });

      // Create check-in (pending approval)
      const checkIn = await prisma.checkIn.create({
        data: {
          userId: context.userId,
          eventId: adHocEvent.id,
          status: "ON_TIME",
          checkInTime: now,
          note: input.note || null,
          isAdHoc: true,
          approved: false,
        },
      });

      return { checkIn, action: "CHECKED_IN", event: adHocEvent };
    },

    approveAdHocCheckIn: async (
      _: unknown,
      { checkInId }: { checkInId: string },
      context: { userId?: string }
    ) => {
      if (!context.userId) throw new Error("Authentication required");

      const checkIn = await prisma.checkIn.findUnique({
        where: { id: checkInId },
        include: { event: true },
      });
      if (!checkIn || !checkIn.isAdHoc) throw new Error("Ad-hoc check-in not found");

      // Verify caller is OWNER, MANAGER, or COACH in the org
      const orgMembership = await prisma.organizationMember.findUnique({
        where: { userId_organizationId: { userId: context.userId, organizationId: checkIn.event.organizationId } },
      });
      if (!orgMembership || !["OWNER", "ADMIN", "MANAGER", "COACH"].includes(orgMembership.role)) {
        throw new Error("Only owners, admins, managers, or coaches can approve ad-hoc check-ins");
      }

      // COACH must be a coach on the specific team
      if (orgMembership.role === "COACH" && checkIn.event.teamId) {
        const teamMembership = await prisma.teamMember.findUnique({
          where: { userId_teamId: { userId: context.userId, teamId: checkIn.event.teamId } },
        });
        if (!teamMembership || !["COACH", "ADMIN"].includes(teamMembership.role)) {
          throw new Error("You can only approve check-ins for teams you coach");
        }
      }

      return prisma.checkIn.update({
        where: { id: checkInId },
        data: { approved: true },
      });
    },

    denyAdHocCheckIn: async (
      _: unknown,
      { checkInId }: { checkInId: string },
      context: { userId?: string }
    ) => {
      if (!context.userId) throw new Error("Authentication required");

      const checkIn = await prisma.checkIn.findUnique({
        where: { id: checkInId },
        include: { event: true },
      });
      if (!checkIn || !checkIn.isAdHoc) throw new Error("Ad-hoc check-in not found");

      // Verify caller is OWNER, MANAGER, or COACH in the org
      const orgMembership = await prisma.organizationMember.findUnique({
        where: { userId_organizationId: { userId: context.userId, organizationId: checkIn.event.organizationId } },
      });
      if (!orgMembership || !["OWNER", "ADMIN", "MANAGER", "COACH"].includes(orgMembership.role)) {
        throw new Error("Only owners, admins, managers, or coaches can deny ad-hoc check-ins");
      }

      // COACH must be a coach on the specific team
      if (orgMembership.role === "COACH" && checkIn.event.teamId) {
        const teamMembership = await prisma.teamMember.findUnique({
          where: { userId_teamId: { userId: context.userId, teamId: checkIn.event.teamId } },
        });
        if (!teamMembership || !["COACH", "ADMIN"].includes(teamMembership.role)) {
          throw new Error("You can only deny check-ins for teams you coach");
        }
      }

      // Delete the check-in and the auto-created ad-hoc event
      await prisma.checkIn.delete({ where: { id: checkInId } });
      await prisma.event.delete({ where: { id: checkIn.eventId } });
      return true;
    },
  },

  NfcTag: {
    organization: (parent: { organizationId: string }, _: unknown, context: Context) =>
      context.loaders.organization.load(parent.organizationId),
    createdAt: (parent: any) => toISO(parent.createdAt),
  },
};
