import {
  NotificationType,
  convertTypeToStatus,
} from '@codesandbox/common/lib/utils/notifications';
import { identify } from '@codesandbox/common/lib/utils/analytics';
import { CurrentTeamInfoFragmentFragment } from 'app/graphql/types';

import { protocolAndHost } from '@codesandbox/common/lib/utils/url-generator';
import { withLoadApp } from './factories';
import * as internalActions from './internalActions';
import { Action, AsyncAction } from '.';
import { TEAM_ID_LOCAL_STORAGE } from './utils/team';

export const internal = internalActions;

export const appUnmounted: AsyncAction = async ({ effects, actions }) => {
  effects.connection.removeListener(actions.connectionChanged);
};

export const sandboxPageMounted: AsyncAction = withLoadApp();

export const searchMounted: AsyncAction = withLoadApp();

export const codesadboxMounted: AsyncAction = withLoadApp();

export const genericPageMounted: AsyncAction = withLoadApp();

export const getPendingUser: AsyncAction = async ({ state, effects }) => {
  if (!state.pendingUserId) return;
  const pendingUser = await effects.api.getPendingUser(state.pendingUserId);
  if (!pendingUser) return;
  state.pendingUser = {
    ...pendingUser,
    valid: true,
  };
};

export const cliMounted: AsyncAction = withLoadApp(
  async ({ state, actions }) => {
    if (state.user) {
      await actions.internal.authorize();
    }
  }
);

export const notificationAdded: Action<{
  title: string;
  notificationType: NotificationType;
  timeAlive?: number;
}> = ({ effects }, { title, notificationType, timeAlive }) => {
  effects.notificationToast.add({
    message: title,
    status: convertTypeToStatus(notificationType),
    timeAlive: timeAlive ? timeAlive * 1000 : undefined,
  });
};

export const notificationRemoved: Action<{
  id: number;
}> = ({ state }, { id }) => {
  const { notifications } = state;
  const notificationToRemoveIndex = notifications.findIndex(
    notification => notification.id === id
  );

  state.notifications.splice(notificationToRemoveIndex, 1);
};

export const cliInstructionsMounted: AsyncAction = withLoadApp();

export const githubPageMounted: AsyncAction = withLoadApp();

export const connectionChanged: Action<boolean> = ({ state }, connected) => {
  state.connected = connected;
};

type ModalName =
  | 'deleteDeployment'
  | 'deleteSandbox'
  | 'feedback'
  | 'forkServerModal'
  | 'liveSessionEnded'
  | 'moveSandbox'
  | 'netlifyLogs'
  | 'preferences'
  | 'searchDependencies'
  | 'share'
  | 'signInForTemplates'
  | 'userSurvey'
  | 'liveSessionEnded';

export const modalOpened: Action<{
  modal: ModalName;
  message?: string;
  itemId?: string;
}> = ({ state, effects }, props) => {
  effects.analytics.track('Open Modal', { modal: props.modal });
  state.currentModal = props.modal;
  if (props.modal === 'preferences' && props.itemId) {
    state.preferences.itemId = props.itemId;
  } else {
    state.currentModalMessage = props.message || null;
  }
};

export const modalClosed: Action = ({ state }) => {
  state.currentModal = null;
};

export const signInClicked: Action<string | void> = ({ state }, redirectTo) => {
  state.signInModalOpen = true;
  state.redirectOnLogin = redirectTo || '';
};

export const toggleSignInModal: Action = ({ state }) => {
  state.signInModalOpen = !state.signInModalOpen;
};

export const signInButtonClicked: AsyncAction<{
  useExtraScopes: boolean;
} | void> = async ({ actions, state }, options) => {
  if (!options) {
    await actions.internal.signIn({
      useExtraScopes: false,
    });
    state.signInModalOpen = false;
    return;
  }
  await actions.internal.signIn(options);
  state.signInModalOpen = false;
};

export const signInCliClicked: AsyncAction = async ({ state, actions }) => {
  await actions.internal.signIn({
    useExtraScopes: false,
  });
  state.signInModalOpen = false;

  await actions.internal.authorize();
};

export const addNotification: Action<{
  message: string;
  type: NotificationType;
  timeAlive: number;
}> = ({ effects }, { message, type, timeAlive }) => {
  effects.notificationToast.add({
    message,
    status: effects.notificationToast.convertTypeToStatus(type),
    timeAlive: timeAlive * 1000,
  });
};

export const removeNotification: Action<number> = ({ state }, id) => {
  const notificationToRemoveIndex = state.notifications.findIndex(
    notification => notification.id === id
  );

  state.notifications.splice(notificationToRemoveIndex, 1);
};

export const signInVercelClicked: AsyncAction = async ({
  state,
  effects: { browser, api, notificationToast },
  actions,
}) => {
  state.isLoadingVercel = true;

  const popup = browser.openPopup('/auth/zeit', 'sign in');
  const data: { code: string } = await browser.waitForMessage('signin');

  popup.close();

  if (data && data.code) {
    try {
      state.user = await api.createVercelIntegration(data.code);
      await actions.deployment.internal.getVercelUserDetails();
    } catch (error) {
      actions.internal.handleError({
        message: 'Could not authorize with Vercel',
        error,
      });
    }
  } else {
    notificationToast.error('Could not authorize with Vercel');
  }

  state.isLoadingVercel = false;
};

export const signOutVercelClicked: AsyncAction = async ({ state, effects }) => {
  if (state.user?.integrations?.zeit) {
    await effects.api.signoutVercel();
    delete state.user.integrations.zeit;
  }
};

export const authTokenRequested: AsyncAction = async ({ actions }) => {
  await actions.internal.authorize();
};

export const requestAuthorisation: AsyncAction = async ({ actions }) => {
  await actions.internal.authorize();
};

export const signInGithubClicked: AsyncAction = async ({ state, actions }) => {
  state.isLoadingGithub = true;
  await actions.internal.signIn({ useExtraScopes: true });
  state.isLoadingGithub = false;
  if (state.editor.currentSandbox?.originalGit) {
    actions.git.loadGitSource();
  }
};

export const signOutClicked: AsyncAction = async ({
  state,
  effects,
  actions,
}) => {
  effects.analytics.track('Sign Out', {});
  state.workspace.openedWorkspaceItem = 'files';
  if (state.live.isLive) {
    actions.live.internal.disconnect();
  }
  await effects.api.signout();
  identify('signed_in', false);
  document.cookie = 'signedIn=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  document.cookie =
    'signedInDev=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  state.hasLogIn = false;
  state.user = null;
  effects.browser.reload();
};

export const signOutGithubIntegration: AsyncAction = async ({
  state,
  effects,
}) => {
  if (state.user?.integrations?.github) {
    await effects.api.signoutGithubIntegration();
    delete state.user.integrations.github;
  }
};

export const setUpdateStatus: Action<{ status: string }> = (
  { state },
  { status }
) => {
  state.updateStatus = status;
};

export const track: Action<{ name: string; data: any }> = (
  { effects },
  { name, data }
) => {
  effects.analytics.track(name, data);
};

export const refetchSandboxInfo: AsyncAction = async ({
  actions,
  effects,
  state,
}) => {
  const sandbox = state.editor.currentSandbox;

  if (!sandbox?.id) {
    return;
  }

  const updatedSandbox = await effects.api.getSandbox(sandbox.id);

  sandbox.collection = updatedSandbox.collection;
  sandbox.owned = updatedSandbox.owned;
  sandbox.userLiked = updatedSandbox.userLiked;
  sandbox.title = updatedSandbox.title;
  sandbox.team = updatedSandbox.team;
  sandbox.roomId = updatedSandbox.roomId;
  sandbox.authorization = updatedSandbox.authorization;
  sandbox.privacy = updatedSandbox.privacy;
  sandbox.featureFlags = updatedSandbox.featureFlags;

  await actions.editor.internal.initializeSandbox(sandbox);
};

export const acceptTeamInvitation: Action<{
  teamName: string;
  teamId: string;
}> = ({ effects, actions }, { teamName }) => {
  effects.analytics.track('Team - Join Team', { source: 'invitation' });
  effects.analytics.track('Team - Invitation Accepted', {});

  actions.internal.trackCurrentTeams();

  effects.notificationToast.success(`Accepted invitation to ${teamName}`);
};

export const rejectTeamInvitation: Action<{ teamName: string }> = (
  { effects },
  { teamName }
) => {
  effects.analytics.track('Team - Invitation Rejected', {});

  effects.notificationToast.success(`Rejected invitation to ${teamName}`);
};

export const setActiveTeam: AsyncAction<{
  id: string | null;
}> = async ({ state, actions, effects }, { id }) => {
  // ignore if its already selected
  if (id === state.activeTeam) return;

  state.activeTeam = id;
  effects.browser.storage.set(TEAM_ID_LOCAL_STORAGE, id);
  state.dashboard.sandboxes = {
    ...state.dashboard.sandboxes,
    DRAFTS: null,
    TEMPLATES: null,
    RECENT: null,
    SEARCH: null,
    ALL: null,
  };

  actions.internal.replaceWorkspaceParameterInUrl();

  if (state.activeTeamInfo?.id !== id) {
    try {
      const teamInfo = await actions.getActiveTeamInfo();
      if (teamInfo) {
        effects.analytics.track('Team - Change Active Team', {
          newTeamId: id,
          newTeamName: teamInfo.name,
        });
      }
    } catch (e) {
      // Something went wrong while fetching the workspace
      actions.setActiveTeam({ id: null });
    }
  }

  actions.internal.trackCurrentTeams();
};

export const getActiveTeamInfo: AsyncAction<
  void,
  CurrentTeamInfoFragmentFragment | null
> = async ({ state, effects }) => {
  if (!state.activeTeam) return null;

  const team = await effects.gql.queries.getTeam({
    teamId: state.activeTeam,
  });

  const currentTeam = team?.me?.team;
  if (!currentTeam) {
    return null;
  }

  state.activeTeamInfo = currentTeam;

  state.activeTeamInfo.userAuthorization = state.activeTeamInfo.userAuthorizations.find(
    auth => auth.userId === state.user!.id
  )!.authorization;

  return currentTeam;
};

export const openCreateSandboxModal: Action<{ collectionId?: string }> = (
  { actions },
  { collectionId }
) => {
  actions.modals.newSandboxModal.open({ collectionId });
};

export const validateUsername: AsyncAction<string> = async (
  { effects, state },
  userName
) => {
  if (!state.pendingUser) return;
  const validity = await effects.api.validateUsername(userName);

  state.pendingUser.valid = validity.available;
};

export const finalizeSignUp: AsyncAction<string> = async (
  { effects, actions, state },
  username
) => {
  if (!state.pendingUser) return;
  try {
    await effects.api.finalizeSignUp({
      id: state.pendingUser.id,
      username,
    });
    window.postMessage(
      {
        type: 'signin',
      },
      protocolAndHost()
    );
  } catch (error) {
    actions.internal.handleError({
      message: 'There was a problem creating your account',
      error,
    });
  }
};
