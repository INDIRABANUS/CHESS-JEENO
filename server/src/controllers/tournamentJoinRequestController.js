import * as tournamentJoinRequestService from '../services/tournamentJoinRequestService.js';

/**
 * Player requests to join a tournament.
 * @route POST /api/tournaments/:id/join-requests
 * @route POST /api/tournaments/:id/join-request
 */
export const createJoinRequest = async (req, res, next) => {
  try {
    const tournamentId = req.params.id;
    const userId = req.user._id;

    const request = await tournamentJoinRequestService.createJoinRequest(tournamentId, userId);

    res.status(201).json({
      success: true,
      message: 'Join request submitted successfully. Awaiting host approval.',
      data: request,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Host views all join requests for a tournament.
 * @route GET /api/tournaments/:id/join-requests
 */
export const getJoinRequests = async (req, res, next) => {
  try {
    const tournamentId = req.params.id;
    const hostUserId = req.user._id;
    const { status } = req.query;

    const requests = await tournamentJoinRequestService.getJoinRequests(
      tournamentId,
      hostUserId,
      status
    );

    res.status(200).json({
      success: true,
      data: requests,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Host approves a join request.
 * @route POST /api/tournaments/:id/join-requests/:requestId/approve
 */
export const approveJoinRequest = async (req, res, next) => {
  try {
    const tournamentId = req.params.id;
    const requestId = req.params.requestId;
    const hostUserId = req.user._id;

    const result = await tournamentJoinRequestService.approveJoinRequest(
      tournamentId,
      requestId,
      hostUserId
    );

    res.status(200).json({
      success: true,
      message: 'Join request approved successfully.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Host rejects a join request.
 * @route POST /api/tournaments/:id/join-requests/:requestId/reject
 */
export const rejectJoinRequest = async (req, res, next) => {
  try {
    const tournamentId = req.params.id;
    const requestId = req.params.requestId;
    const hostUserId = req.user._id;

    const request = await tournamentJoinRequestService.rejectJoinRequest(
      tournamentId,
      requestId,
      hostUserId
    );

    res.status(200).json({
      success: true,
      message: 'Join request rejected.',
      data: request,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Current user checks their join request status.
 * @route GET /api/tournaments/:id/join-requests/my-status
 * @route GET /api/tournaments/:id/my-join-request
 */
export const getMyJoinRequestStatus = async (req, res, next) => {
  try {
    const tournamentId = req.params.id;
    const userId = req.user ? req.user._id : null;

    const statusData = await tournamentJoinRequestService.getJoinRequestStatus(
      tournamentId,
      userId
    );

    res.status(200).json({
      success: true,
      data: statusData,
    });
  } catch (error) {
    next(error);
  }
};
