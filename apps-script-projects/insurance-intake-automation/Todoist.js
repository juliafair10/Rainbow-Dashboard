function listTodoistProjects() {
  const startedAt = new Date();
  const result = {
    automation: CONFIG.automationName,
    phase: CONFIG.phase,
    workflow: 'Todoist Project List',
    readOnly: true,
    startedAt: startedAt,
    finishedAt: null,
    projects: []
  };

  try {
    const todoist = getTodoistConfig_();

    if (!todoist.apiToken) {
      throw new Error('Missing TODOIST_API_TOKEN script property.');
    }

    const response = UrlFetchApp.fetch('https://api.todoist.com/api/v1/sync', {
      method: 'post',
      contentType: 'application/json',
      headers: {
        Authorization: 'Bearer ' + todoist.apiToken
      },
      payload: JSON.stringify({
        sync_token: '*',
        resource_types: ['projects', 'sections', 'collaborators']
      }),
      muteHttpExceptions: true
    });

    const code = response.getResponseCode();
    const body = response.getContentText();

    if (code < 200 || code >= 300) {
      throw new Error('Todoist project list failed: HTTP ' + code + ' - ' + body);
    }

    const data = JSON.parse(body || '{}');
    const sections = data.sections || [];
    const collaborators = data.collaborators || [];

    result.projects = (data.projects || []).map(function(project) {
      return {
        id: project.id || '',
        name: project.name || '',
        isShared: project.is_shared === true,
        sectionCount: sections.filter(function(section) {
          return String(section.project_id || '') === String(project.id || '');
        }).length
      };
    });

    result.sections = sections.map(function(section) {
      return {
        id: section.id || '',
        name: section.name || '',
        projectId: section.project_id || ''
      };
    });

    result.collaborators = collaborators.map(function(collaborator) {
      return {
        id: collaborator.id || '',
        name: collaborator.full_name || collaborator.name || '',
        email: collaborator.email || ''
      };
    });

    result.finishedAt = new Date();

    return {
      status: 'Success',
      message: 'Todoist project list succeeded. Found ' + result.projects.length + ' project(s).',
      result: result
    };
  } catch (error) {
    result.finishedAt = new Date();
    result.error = error.message;

    return {
      status: 'Error',
      message: error.message,
      result: result
    };
  }
}

function testTodoistConnection() {
  const startedAt = new Date();
  const result = {
    automation: CONFIG.automationName,
    phase: CONFIG.phase,
    workflow: 'Todoist Connection Test',
    readOnly: true,
    startedAt: startedAt,
    finishedAt: null,
    config: {
      enabled: CONFIG.todoist && CONFIG.todoist.enabled === true,
      hasApiToken: false,
      hasProjectId: false,
      hasAssigneeIdClarence: false,
      hasSectionId: false,
      dueString: CONFIG.todoist && CONFIG.todoist.dueString ? CONFIG.todoist.dueString : '',
      priority: CONFIG.todoist && CONFIG.todoist.priority ? CONFIG.todoist.priority : ''
    },
    todoist: {
      reachable: false,
      projectTaskCount: 0,
      sampleTasks: []
    }
  };

  try {
    const todoist = getTodoistConfig_();
    result.config.hasApiToken = !!todoist.apiToken;
    result.config.hasProjectId = !!todoist.projectId;
    result.config.hasAssigneeIdClarence = !!todoist.assigneeId;
    result.config.hasSectionId = !!todoist.sectionId;

    if (!todoist.apiToken) {
      throw new Error('Missing TODOIST_API_TOKEN script property.');
    }

    if (!todoist.projectId) {
      throw new Error('Missing TODOIST_PROJECT_ID script property.');
    }

    const url = 'https://api.todoist.com/api/v1/tasks?project_id=' + encodeURIComponent(todoist.projectId) + '&limit=200';
    const response = UrlFetchApp.fetch(url, {
      method: 'get',
      headers: {
        Authorization: 'Bearer ' + todoist.apiToken
      },
      muteHttpExceptions: true
    });

    const code = response.getResponseCode();
    const body = response.getContentText();

    if (code < 200 || code >= 300) {
      throw new Error('Todoist connection test failed: HTTP ' + code + ' - ' + body);
    }

    const parsed = JSON.parse(body || '{}');
    const tasks = parsed.results || [];
    result.todoist.reachable = true;
    result.todoist.projectTaskCount = tasks.length;
    result.todoist.sampleTasks = tasks.slice(0, 5).map(function(task) {
      return {
        id: task.id || '',
        content: task.content || '',
        url: task.url || ''
      };
    });
    result.finishedAt = new Date();

    return {
      status: 'Success',
      message: 'Todoist connection test succeeded. Found ' + tasks.length + ' task(s) in the configured project.',
      result: result
    };
  } catch (error) {
    result.finishedAt = new Date();
    result.error = error.message;

    return {
      status: 'Error',
      message: error.message,
      result: result
    };
  }
}

function createOrSkipTodoistIntakeTask_(claimData, folderResult, thread) {
  const result = {
    enabled: CONFIG.todoist && CONFIG.todoist.enabled === true,
    success: true,
    skipped: false,
    duplicate: false,
    taskId: '',
    taskUrl: '',
    status: 'todoist_disabled',
    message: ''
  };

  if (!result.enabled) {
    result.skipped = true;
    result.message = 'Todoist integration is disabled.';
    return result;
  }

  try {
    const existingTask = searchTodoistTaskByClaimNumber_(claimData.claimNumber);

    if (existingTask) {
      result.duplicate = true;
      result.taskId = existingTask.id || '';
      result.taskUrl = existingTask.url || '';
      result.status = 'todoist_duplicate_skipped';
      result.message = 'Todoist task already exists for claim ' + claimData.claimNumber + '.';
      return result;
    }

    const createdTask = createTodoistIntakeTask_({
      customerName: claimData.customerName,
      claimNumber: claimData.claimNumber,
      subject: claimData.subject,
      folderId: folderResult.folderId,
      folderUrl: folderResult.folderUrl,
      threadId: thread.getId(),
      intakeDate: thread.getMessages()[0].getDate()
    });

    result.taskId = createdTask.id || '';
    result.taskUrl = createdTask.url || '';
    result.status = 'todoist_task_created';
    result.message = 'Created Todoist task for claim ' + claimData.claimNumber + '.';
    return result;
  } catch (error) {
    result.success = false;
    result.status = 'todoist_error';
    result.error = error.message;
    return result;
  }
}

function getTodoistConfig_() {
  const props = PropertiesService.getScriptProperties();
  const todoistConfig = CONFIG.todoist || {};

  return {
    apiToken: props.getProperty(todoistConfig.apiTokenProperty || 'TODOIST_API_TOKEN'),
    projectId: props.getProperty(todoistConfig.projectIdProperty || 'TODOIST_PROJECT_ID'),
    assigneeId: props.getProperty(todoistConfig.assigneeIdClarenceProperty || 'TODOIST_ASSIGNEE_ID_CLARENCE'),
    sectionId: props.getProperty(todoistConfig.sectionIdProperty || 'TODOIST_SECTION_ID'),
    dueString: todoistConfig.dueString || 'today',
    priority: todoistConfig.priority || 3
  };
}

function searchTodoistTaskByClaimNumber_(claimNumber) {
  const todoist = getTodoistConfig_();

  if (!claimNumber) {
    throw new Error('Cannot search Todoist without a claim number.');
  }

  if (!todoist.apiToken) {
    throw new Error('Missing TODOIST_API_TOKEN script property.');
  }

  if (!todoist.projectId) {
    throw new Error('Missing TODOIST_PROJECT_ID script property.');
  }

  const url = 'https://api.todoist.com/api/v1/tasks?project_id=' + encodeURIComponent(todoist.projectId) + '&limit=200';
  const response = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: {
      Authorization: 'Bearer ' + todoist.apiToken
    },
    muteHttpExceptions: true
  });

  const code = response.getResponseCode();
  const body = response.getContentText();

  if (code < 200 || code >= 300) {
    throw new Error('Todoist task search failed: HTTP ' + code + ' - ' + body);
  }

  const parsed = JSON.parse(body || '{}');
  const tasks = parsed.results || [];
  const normalizedClaimNumber = String(claimNumber || '').trim();

  return tasks.find(function(task) {
    const content = String(task.content || '');
    const description = String(task.description || '');
    return content.indexOf(normalizedClaimNumber) !== -1 || description.indexOf(normalizedClaimNumber) !== -1;
  }) || null;
}

function createTodoistIntakeTask_(payload) {
  const todoist = getTodoistConfig_();

  if (!todoist.apiToken) {
    throw new Error('Missing TODOIST_API_TOKEN script property.');
  }

  if (!todoist.projectId) {
    throw new Error('Missing TODOIST_PROJECT_ID script property.');
  }

  if (!todoist.assigneeId) {
    throw new Error('Missing TODOIST_ASSIGNEE_ID_CLARENCE script property.');
  }

  const intakeDate = payload.intakeDate || new Date();
  const dueDate = new Date(intakeDate);
  dueDate.setDate(dueDate.getDate() + 3);

  const formattedDueDate = Utilities.formatDate(
    dueDate,
    Session.getScriptTimeZone(),
    'MM/dd/yyyy'
  );

  const todoistDeadlineDate = Utilities.formatDate(
    dueDate,
    Session.getScriptTimeZone(),
    'yyyy-MM-dd'
  );

  const task = {
    content: buildTodoistIntakeTaskTitle_(payload.customerName, payload.claimNumber),
    description: 'Upload 3 Day - due ' + formattedDueDate,
    project_id: todoist.projectId,
    assignee_id: Number(todoist.assigneeId),
    priority: todoist.priority,
    due_date: todoistDeadlineDate,
    deadline_date: todoistDeadlineDate
  };

  if (todoist.sectionId) {
    task.section_id = todoist.sectionId;
  }

  const response = UrlFetchApp.fetch('https://api.todoist.com/api/v1/tasks', {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + todoist.apiToken
    },
    payload: JSON.stringify(task),
    muteHttpExceptions: true
  });

  const code = response.getResponseCode();
  const body = response.getContentText();

  if (code < 200 || code >= 300) {
    throw new Error('Todoist task creation failed: HTTP ' + code + ' - ' + body);
  }

  return JSON.parse(body || '{}');
}

function buildTodoistIntakeTaskTitle_(customerName, claimNumber) {
  return String(customerName || 'UNKNOWN CUSTOMER').trim() + ' - ' + String(claimNumber || '').trim();
}

function buildTodoistIntakeTaskDescription_(payload) {
  return "Upload 3 day - due (3 days from 'today')";
}

function buildTodoistDeadlineDate_(daysFromToday) {
  const deadline = new Date();
  deadline.setDate(deadline.getDate() + daysFromToday);
  return Utilities.formatDate(deadline, Session.getScriptTimeZone(), 'yyyy-MM-dd');

}

