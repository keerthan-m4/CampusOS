import { useEffect, useMemo, useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  useLocation,
} from "react-router-dom";

const API_BASE_URL = "https://campusos-rios.onrender.com";

function getSavedAuth() {
  try {
    const saved = localStorage.getItem("campusosAuth");
    if (!saved) return null;

    const parsed = JSON.parse(saved);

    if (
      !parsed ||
      typeof parsed.token !== "string" ||
      !parsed.user
    ) {
      return null;
    }

    return parsed;
  } catch (error) {
    console.error("Failed to restore login session:", error);
    return null;
  }
}

function saveAuthSession(auth) {
  localStorage.setItem("campusosAuth", JSON.stringify(auth));
}

async function campusApiFetch(path, token, options = {}) {
  const headers = {
    ...(options.headers || {}),
    Authorization: `Bearer ${token}`,
  };

  if (options.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  return fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });
}

function formatDate(dateString) {
  if (!dateString) {
    return {
      day: "-",
      month: "---",
    };
  }

  const [year, month, day] = dateString
    .split("T")[0]
    .split("-");

  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day)
  );

  return {
    day: date.getDate(),
    month: date
      .toLocaleString("en-US", {
        month: "short",
      })
      .toUpperCase(),
  };
}

function getLocalDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getTaskDateKey(task) {
  if (!task.dueDate) {
    return "";
  }

  return task.dueDate.split("T")[0];
}

function getDeadlineStatus(task) {
  if (task.completed) {
    return {
      label: "Completed",
      className: "completed",
    };
  }

  if (!task.dueDate) {
    return {
      label: "No deadline",
      className: "no-deadline",
    };
  }

  const today = new Date();
  const todayKey = getLocalDateKey(today);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const tomorrowKey = getLocalDateKey(tomorrow);
  const taskDateKey = getTaskDateKey(task);

  if (taskDateKey < todayKey) {
    return {
      label: "Overdue",
      className: "overdue",
    };
  }

  if (taskDateKey === todayKey) {
    return {
      label: "Due Today",
      className: "today-deadline",
    };
  }

  if (taskDateKey === tomorrowKey) {
    return {
      label: "Due Tomorrow",
      className: "tomorrow",
    };
  }

  return {
    label: "Upcoming",
    className: "upcoming",
  };
}

function TaskItem({
  task,
  onEdit,
  onDelete,
  onToggleComplete,
}) {
  const date = formatDate(task.dueDate);
  const deadline = getDeadlineStatus(task);

  const priorityClass =
    task.priority?.toLowerCase() || "medium";

  return (
    <div
      className={`timeline-item ${
        task.completed ? "completed-task" : ""
      }`}
    >
      <button
        className={`complete-button ${
          task.completed ? "completed" : ""
        }`}
        onClick={() =>
          onToggleComplete(task)
        }
        title={
          task.completed
            ? "Mark as pending"
            : "Mark as completed"
        }
      >
        {task.completed ? "✓" : ""}
      </button>

      <div className="date">
        {date.day}
        <br />
        <small>{date.month}</small>
      </div>

      <div className="task-content">
        <strong>{task.title}</strong>

        <p>
          {task.subject || "No subject specified"}
        </p>

        <span
          className={`deadline-badge ${deadline.className}`}
        >
          {deadline.label}
        </span>
      </div>

      <span
        className={`priority-badge ${priorityClass}`}
      >
        {task.priority || "Medium"}
      </span>

      <div className="task-actions">
        <button
          className="edit-task-button"
          onClick={() => onEdit(task)}
          title="Edit task"
        >
          ✏️
        </button>

        <button
          className="delete-task-button"
          onClick={() => onDelete(task)}
          title="Delete task"
        >
          🗑️
        </button>
      </div>
    </div>
  );
}

function TaskFilters({
  search,
  setSearch,
  priority,
  setPriority,
  status,
  setStatus,
  sortOrder,
  setSortOrder,
}) {
  return (
    <div className="task-filters">
      <div className="search-box">
        <span>🔍</span>

        <input
          type="text"
          placeholder="Search by title or subject..."
          value={search}
          onChange={(event) =>
            setSearch(event.target.value)
          }
        />
      </div>

      <select
        value={priority}
        onChange={(event) =>
          setPriority(event.target.value)
        }
      >
        <option value="All">
          All Priorities
        </option>

        <option value="High">
          High
        </option>

        <option value="Medium">
          Medium
        </option>

        <option value="Low">
          Low
        </option>
      </select>

      <select
        value={status}
        onChange={(event) =>
          setStatus(event.target.value)
        }
      >
        <option value="All">
          All Status
        </option>

        <option value="Pending">
          Pending
        </option>

        <option value="Completed">
          Completed
        </option>
      </select>

      <select
        value={sortOrder}
        onChange={(event) =>
          setSortOrder(event.target.value)
        }
      >
        <option value="nearest">
          Nearest Date
        </option>

        <option value="farthest">
          Farthest Date
        </option>

        <option value="priority">
          Priority
        </option>

        <option value="name">
          Name
        </option>
      </select>
    </div>
  );
}

function FilteredTaskPage({
  title,
  description,
  tasks,
  type,
  onEdit,
  onDelete,
  onToggleComplete,
}) {
  const [search, setSearch] = useState("");
  const [priority, setPriority] =
    useState("All");
  const [status, setStatus] =
    useState("All");
  const [sortOrder, setSortOrder] =
    useState("nearest");

  const filteredTasks = useMemo(() => {
    let result = tasks.filter(
      (task) => task.type === type
    );

    if (search.trim()) {
      const searchText =
        search.toLowerCase();

      result = result.filter((task) => {
        const taskTitle =
          task.title?.toLowerCase() || "";

        const subject =
          task.subject?.toLowerCase() || "";

        return (
          taskTitle.includes(searchText) ||
          subject.includes(searchText)
        );
      });
    }

    if (priority !== "All") {
      result = result.filter(
        (task) =>
          task.priority === priority
      );
    }

    if (status === "Pending") {
      result = result.filter(
        (task) => !task.completed
      );
    }

    if (status === "Completed") {
      result = result.filter(
        (task) => task.completed
      );
    }

    result.sort((a, b) => {
      if (sortOrder === "name") {
        return a.title.localeCompare(
          b.title
        );
      }

      if (sortOrder === "priority") {
        const priorityOrder = {
          High: 1,
          Medium: 2,
          Low: 3,
        };

        return (
          (priorityOrder[a.priority] || 4) -
          (priorityOrder[b.priority] || 4)
        );
      }

      const dateA = new Date(
        a.dueDate || "9999-12-31"
      );

      const dateB = new Date(
        b.dueDate || "9999-12-31"
      );

      if (sortOrder === "farthest") {
        return dateB - dateA;
      }

      return dateA - dateB;
    });

    return result;
  }, [
    tasks,
    type,
    search,
    priority,
    status,
    sortOrder,
  ]);

  return (
    <div className="page">
      <div className="page-title-row">
        <div>
          <h1>{title}</h1>

          <p>{description}</p>
        </div>

        <span className="result-count">
          {filteredTasks.length} found
        </span>
      </div>

      <TaskFilters
        search={search}
        setSearch={setSearch}
        priority={priority}
        setPriority={setPriority}
        status={status}
        setStatus={setStatus}
        sortOrder={sortOrder}
        setSortOrder={setSortOrder}
      />

      <div className="task-list">
        {filteredTasks.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              {type === "assignment"
                ? "📝"
                : type === "exam"
                ? "🧪"
                : "🎯"}
            </div>

            <h3>
              No {type}s found
            </h3>

            <p>
              Try changing your search or
              filter settings.
            </p>
          </div>
        ) : (
          filteredTasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              onEdit={onEdit}
              onDelete={onDelete}
              onToggleComplete={
                onToggleComplete
              }
            />
          ))
        )}
      </div>
    </div>
  );
}

function Calendar({
  tasks,
  onEdit,
  onDelete,
  onToggleComplete,
}) {
  const today = new Date();

  const [currentMonth, setCurrentMonth] =
    useState(
      new Date(
        today.getFullYear(),
        today.getMonth(),
        1
      )
    );

  const [selectedDate, setSelectedDate] =
    useState(getLocalDateKey(today));

  const monthName =
    currentMonth.toLocaleString(
      "en-US",
      {
        month: "long",
      }
    );

  const year =
    currentMonth.getFullYear();

  const month =
    currentMonth.getMonth();

  const firstDay = new Date(
    year,
    month,
    1
  ).getDay();

  const daysInMonth = new Date(
    year,
    month + 1,
    0
  ).getDate();

  const calendarDays = [];

  for (let i = 0; i < firstDay; i++) {
    calendarDays.push(null);
  }

  for (
    let day = 1;
    day <= daysInMonth;
    day++
  ) {
    calendarDays.push(
      new Date(year, month, day)
    );
  }

  const selectedTasks = useMemo(() => {
    return tasks.filter(
      (task) =>
        getTaskDateKey(task) ===
        selectedDate
    );
  }, [tasks, selectedDate]);

  const goToPreviousMonth = () => {
    const newMonth = new Date(
      year,
      month - 1,
      1
    );

    setCurrentMonth(newMonth);
    setSelectedDate(
      getLocalDateKey(newMonth)
    );
  };

  const goToNextMonth = () => {
    const newMonth = new Date(
      year,
      month + 1,
      1
    );

    setCurrentMonth(newMonth);
    setSelectedDate(
      getLocalDateKey(newMonth)
    );
  };

  const goToToday = () => {
    const todayDate = new Date();

    setCurrentMonth(
      new Date(
        todayDate.getFullYear(),
        todayDate.getMonth(),
        1
      )
    );

    setSelectedDate(
      getLocalDateKey(todayDate)
    );
  };

  const getTasksForDate = (date) => {
    if (!date) {
      return [];
    }

    const dateKey =
      getLocalDateKey(date);

    return tasks.filter(
      (task) =>
        getTaskDateKey(task) ===
        dateKey
    );
  };

  return (
    <div className="calendar-page">
      <div className="calendar-header">
        <div>
          <h1>Academic Calendar</h1>

          <p>
            Manage your assignments,
            exams, events and tasks.
          </p>
        </div>

        <button
          className="today-button"
          onClick={goToToday}
        >
          Today
        </button>
      </div>

      <div className="calendar-panel">
        <div className="calendar-toolbar">
          <button
            className="calendar-nav-button"
            onClick={
              goToPreviousMonth
            }
          >
            ←
          </button>

          <h2>
            {monthName} {year}
          </h2>

          <button
            className="calendar-nav-button"
            onClick={
              goToNextMonth
            }
          >
            →
          </button>
        </div>

        <div className="calendar-weekdays">
          <div>Sun</div>
          <div>Mon</div>
          <div>Tue</div>
          <div>Wed</div>
          <div>Thu</div>
          <div>Fri</div>
          <div>Sat</div>
        </div>

        <div className="calendar-grid">
          {calendarDays.map(
            (date, index) => {
              if (!date) {
                return (
                  <div
                    className="calendar-cell empty"
                    key={`empty-${index}`}
                  />
                );
              }

              const dateKey =
                getLocalDateKey(date);

              const dayTasks =
                getTasksForDate(date);

              const isToday =
                dateKey ===
                getLocalDateKey(today);

              const isSelected =
                dateKey ===
                selectedDate;

              const hasAssignments =
                dayTasks.some(
                  (task) =>
                    task.type ===
                    "assignment"
                );

              const hasExams =
                dayTasks.some(
                  (task) =>
                    task.type === "exam"
                );

              const hasEvents =
                dayTasks.some(
                  (task) =>
                    task.type === "event"
                );

              const hasGeneralTasks =
                dayTasks.some(
                  (task) =>
                    task.type === "task"
                );

              return (
                <button
                  key={dateKey}
                  className={`calendar-cell ${
                    isToday
                      ? "today"
                      : ""
                  } ${
                    isSelected
                      ? "selected"
                      : ""
                  }`}
                  onClick={() =>
                    setSelectedDate(
                      dateKey
                    )
                  }
                >
                  <span className="calendar-day-number">
                    {date.getDate()}
                  </span>

                  {dayTasks.length >
                    0 && (
                    <div className="calendar-indicators">
                      {hasAssignments && (
                        <span className="calendar-dot assignment-dot" />
                      )}

                      {hasExams && (
                        <span className="calendar-dot exam-dot" />
                      )}

                      {hasEvents && (
                        <span className="calendar-dot event-dot" />
                      )}

                      {hasGeneralTasks && (
                        <span className="calendar-dot task-dot" />
                      )}
                    </div>
                  )}

                  {dayTasks.length >
                    0 && (
                    <span className="calendar-task-count">
                      {dayTasks.length}
                    </span>
                  )}
                </button>
              );
            }
          )}
        </div>
      </div>

      <div className="calendar-bottom">
        <div className="calendar-legend">
          <h3>Calendar Legend</h3>

          <div className="legend-items">
            <span>
              <i className="calendar-dot assignment-dot" />
              Assignment
            </span>

            <span>
              <i className="calendar-dot exam-dot" />
              Exam
            </span>

            <span>
              <i className="calendar-dot event-dot" />
              Event
            </span>

            <span>
              <i className="calendar-dot task-dot" />
              Task
            </span>
          </div>
        </div>

        <div className="selected-day-panel">
          <h3>
            {selectedDate
              ? new Date(
                  `${selectedDate}T00:00:00`
                ).toLocaleDateString(
                  "en-US",
                  {
                    weekday:
                      "long",
                    month:
                      "long",
                    day: "numeric",
                    year: "numeric",
                  }
                )
              : "Selected Day"}
          </h3>

          {selectedTasks.length ===
          0 ? (
            <p className="empty-day">
              No activities scheduled
              for this day.
            </p>
          ) : (
            selectedTasks.map(
              (task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onToggleComplete={
                    onToggleComplete
                  }
                />
              )
            )
          )}
        </div>
      </div>
    </div>
  );
}


function SubjectOverview({ tasks }) {
  const subjectData = useMemo(() => {
    const grouped = {};

    tasks.forEach((task) => {
      const subject = task.subject?.trim() || "General";

      if (!grouped[subject]) {
        grouped[subject] = {
          total: 0,
          completed: 0,
          pending: 0,
        };
      }

      grouped[subject].total += 1;

      if (task.completed) {
        grouped[subject].completed += 1;
      } else {
        grouped[subject].pending += 1;
      }
    });

    return Object.entries(grouped)
      .map(([subject, data]) => ({
        subject,
        ...data,
        percentage:
          data.total === 0
            ? 0
            : Math.round(
                (data.completed / data.total) * 100
              ),
      }))
      .sort((a, b) => {
        if (b.pending !== a.pending) {
          return b.pending - a.pending;
        }

        return a.subject.localeCompare(b.subject);
      });
  }, [tasks]);

  return (
    <div className="panel subject-overview-panel">
      <div className="panel-header">
        <h2>Subject Overview</h2>

        <span className="panel-count">
          {subjectData.length} subjects
        </span>
      </div>

      {subjectData.length === 0 ? (
        <p className="empty-panel-text">
          Add tasks with subjects to see your workload.
        </p>
      ) : (
        <div className="subject-list">
          {subjectData.map((item) => (
            <div
              className="subject-item"
              key={item.subject}
            >
              <div className="subject-item-header">
                <strong>{item.subject}</strong>

                <span>
                  {item.completed}/{item.total}
                </span>
              </div>

              <div className="subject-progress-bar">
                <div
                  className="subject-progress-fill"
                  style={{
                    width: `${item.percentage}%`,
                  }}
                />
              </div>

              <small>
                {item.pending === 0
                  ? "All tasks completed"
                  : `${item.pending} pending`}
              </small>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TodayFocus({
  tasks,
  onEdit,
  onDelete,
  onToggleComplete,
}) {
  const todayKey = getLocalDateKey(new Date());

  const focusTasks = useMemo(() => {
    const todayTasks = tasks.filter(
      (task) =>
        !task.completed &&
        getTaskDateKey(task) === todayKey
    );

    const overdueTasks = tasks.filter(
      (task) =>
        !task.completed &&
        getTaskDateKey(task) &&
        getTaskDateKey(task) < todayKey
    );

    const priorityOrder = {
      High: 1,
      Medium: 2,
      Low: 3,
    };

    return [...overdueTasks, ...todayTasks]
      .sort((a, b) => {
        const deadlineA =
          getTaskDateKey(a) < todayKey ? 0 : 1;

        const deadlineB =
          getTaskDateKey(b) < todayKey ? 0 : 1;

        if (deadlineA !== deadlineB) {
          return deadlineA - deadlineB;
        }

        return (
          (priorityOrder[a.priority] || 4) -
          (priorityOrder[b.priority] || 4)
        );
      })
      .slice(0, 4);
  }, [tasks, todayKey]);

  const overdueCount = tasks.filter(
    (task) =>
      !task.completed &&
      getTaskDateKey(task) &&
      getTaskDateKey(task) < todayKey
  ).length;

  const todayCount = tasks.filter(
    (task) =>
      !task.completed &&
      getTaskDateKey(task) === todayKey
  ).length;

  return (
    <div className="panel today-focus-panel">
      <div className="panel-header">
        <div>
          <h2>Today's Focus</h2>

          <p className="panel-subtitle">
            {overdueCount > 0
              ? `${overdueCount} overdue · ${todayCount} due today`
              : `${todayCount} due today`}
          </p>
        </div>

        <span className="focus-icon">⚡</span>
      </div>

      {focusTasks.length === 0 ? (
        <div className="focus-empty">
          <div>🎉</div>

          <strong>You're all caught up!</strong>

          <p>
            No overdue or due-today tasks.
          </p>
        </div>
      ) : (
        <div className="focus-task-list">
          {focusTasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              onEdit={onEdit}
              onDelete={onDelete}
              onToggleComplete={
                onToggleComplete
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}


function WeeklyWorkload({ tasks }) {
  const workload = useMemo(() => {
    const today = new Date();

    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(today);
      date.setHours(0, 0, 0, 0);
      date.setDate(today.getDate() + index);

      const dateKey = getLocalDateKey(date);
      const count = tasks.filter(
        (task) =>
          !task.completed &&
          getTaskDateKey(task) === dateKey
      ).length;

      return {
        dateKey,
        count,
        label: index === 0
          ? "Today"
          : date.toLocaleString("en-US", { weekday: "short" }),
        day: date.getDate(),
      };
    });
  }, [tasks]);

  const maxCount = Math.max(
    ...workload.map((day) => day.count),
    1
  );

  const total = workload.reduce(
    (sum, day) => sum + day.count,
    0
  );

  return (
    <div className="panel weekly-workload-panel">
      <div className="panel-header">
        <div>
          <h2>Weekly Workload</h2>
          <p className="panel-subtitle">
            {total} pending {total === 1 ? "task" : "tasks"} in the next 7 days
          </p>
        </div>
        <span className="feature-icon">📊</span>
      </div>

      <div className="workload-chart">
        {workload.map((day) => (
          <div className="workload-day" key={day.dateKey}>
            <div className="workload-count">
              {day.count}
            </div>
            <div className="workload-bar-track">
              <div
                className={`workload-bar ${day.count === 0 ? "empty" : ""}`}
                style={{
                  height: `${Math.max(
                    day.count === 0 ? 8 : (day.count / maxCount) * 100,
                    8
                  )}%`,
                }}
              />
            </div>
            <strong>{day.label}</strong>
            <small>{day.day}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

function SmartFocus({ tasks, onEdit, onToggleComplete }) {
  const focusTask = useMemo(() => {
    const todayKey = getLocalDateKey(new Date());

    const priorityOrder = {
      High: 1,
      Medium: 2,
      Low: 3,
    };

    return tasks
      .filter((task) => !task.completed)
      .sort((a, b) => {
        const dateA = getTaskDateKey(a);
        const dateB = getTaskDateKey(b);

        const overdueA = dateA && dateA < todayKey ? 0 : 1;
        const overdueB = dateB && dateB < todayKey ? 0 : 1;

        if (overdueA !== overdueB) {
          return overdueA - overdueB;
        }

        const priorityA = priorityOrder[a.priority] || 4;
        const priorityB = priorityOrder[b.priority] || 4;

        if (priorityA !== priorityB) {
          return priorityA - priorityB;
        }

        if (!dateA) return 1;
        if (!dateB) return -1;

        return dateA.localeCompare(dateB);
      })[0] || null;
  }, [tasks]);

  if (!focusTask) {
    return (
      <div className="panel smart-focus-panel">
        <div className="panel-header">
          <div>
            <h2>Smart Focus</h2>
            <p className="panel-subtitle">Your next best task</p>
          </div>
          <span className="feature-icon">🧠</span>
        </div>

        <div className="smart-empty">
          <div>✨</div>
          <strong>Nothing pending</strong>
          <p>Great work! You're completely caught up.</p>
        </div>
      </div>
    );
  }

  const status = getDeadlineStatus(focusTask);

  return (
    <div className="panel smart-focus-panel">
      <div className="panel-header">
        <div>
          <h2>Smart Focus</h2>
          <p className="panel-subtitle">Your next best task</p>
        </div>
        <span className="feature-icon">🧠</span>
      </div>

      <div className="smart-focus-content">
        <span className={`deadline-badge ${status.className}`}>
          {status.label}
        </span>

        <h3>{focusTask.title}</h3>

        <p>
          {focusTask.subject || "General task"} · {focusTask.priority || "Medium"} priority
        </p>

        <div className="smart-focus-reason">
          <span>💡</span>
          <span>
            {status.className === "overdue"
              ? "This task is overdue, so it should be your first priority."
              : focusTask.priority === "High"
              ? "High-priority work is recommended first."
              : "This is the next pending task by deadline."}
          </span>
        </div>

        <div className="smart-focus-actions">
          <button
            className="primary-action"
            onClick={() => onToggleComplete(focusTask)}
          >
            ✓ Complete
          </button>
          <button
            className="secondary-action"
            onClick={() => onEdit(focusTask)}
          >
            Edit
          </button>
        </div>
      </div>
    </div>
  );
}

function FocusTimer() {
  const getStoredTimer = () => {
    try {
      const saved = localStorage.getItem("campusosFocusTimer");
      const settings = localStorage.getItem("campusosFocusTimerSettings");

      const parsedSettings = settings ? JSON.parse(settings) : {};
      const focusMinutes =
        typeof parsedSettings.focusMinutes === "number"
          ? parsedSettings.focusMinutes
          : 25;
      const breakMinutes =
        typeof parsedSettings.breakMinutes === "number"
          ? parsedSettings.breakMinutes
          : 5;

      if (saved) {
        const parsed = JSON.parse(saved);
        const mode = parsed.mode === "break" ? "break" : "focus";
        const defaultSeconds =
          (mode === "focus" ? focusMinutes : breakMinutes) * 60;

        if (parsed.running && parsed.endTime) {
          const remaining = Math.max(
            0,
            Math.ceil((parsed.endTime - Date.now()) / 1000)
          );

          return {
            mode,
            secondsLeft: remaining,
            running: remaining > 0,
            endTime: remaining > 0 ? parsed.endTime : null,
            focusMinutes,
            breakMinutes,
          };
        }

        return {
          mode,
          secondsLeft:
            typeof parsed.secondsLeft === "number"
              ? Math.max(0, parsed.secondsLeft)
              : defaultSeconds,
          running: false,
          endTime: null,
          focusMinutes,
          breakMinutes,
        };
      }

      return {
        mode: "focus",
        secondsLeft: focusMinutes * 60,
        running: false,
        endTime: null,
        focusMinutes,
        breakMinutes,
      };
    } catch (error) {
      console.error("Failed to restore focus timer:", error);

      return {
        mode: "focus",
        secondsLeft: 25 * 60,
        running: false,
        endTime: null,
        focusMinutes: 25,
        breakMinutes: 5,
      };
    }
  };

  const [timerState, setTimerState] = useState(getStoredTimer);
  const [customMinutes, setCustomMinutes] = useState("");

  const {
    mode,
    secondsLeft,
    running,
    endTime,
    focusMinutes,
    breakMinutes,
  } = timerState;

  useEffect(() => {
    try {
      localStorage.setItem(
        "campusosFocusTimer",
        JSON.stringify({
          mode,
          secondsLeft,
          running,
          endTime,
        })
      );

      localStorage.setItem(
        "campusosFocusTimerSettings",
        JSON.stringify({
          focusMinutes,
          breakMinutes,
        })
      );
    } catch (error) {
      console.error("Failed to save focus timer:", error);
    }
  }, [
    mode,
    secondsLeft,
    running,
    endTime,
    focusMinutes,
    breakMinutes,
  ]);

  useEffect(() => {
    if (!running || !endTime) {
      return undefined;
    }

    const updateTimer = () => {
      const remaining = Math.max(
        0,
        Math.ceil((endTime - Date.now()) / 1000)
      );

      if (remaining <= 0) {
        setTimerState((current) => ({
          ...current,
          secondsLeft: 0,
          running: false,
          endTime: null,
        }));
        return;
      }

      setTimerState((current) => ({
        ...current,
        secondsLeft: remaining,
      }));
    };

    updateTimer();

    const timer = setInterval(updateTimer, 250);

    return () => clearInterval(timer);
  }, [running, endTime]);

  const changeMode = (nextMode) => {
    const nextSeconds =
      (nextMode === "focus" ? focusMinutes : breakMinutes) * 60;

    setTimerState((current) => ({
      ...current,
      mode: nextMode,
      secondsLeft: nextSeconds,
      running: false,
      endTime: null,
    }));

    setCustomMinutes("");
  };

  const applyCustomTime = () => {
    const value = Number(customMinutes);

    if (!Number.isFinite(value) || value < 1 || value > 180) {
      return;
    }

    const roundedValue = Math.round(value);
    const seconds = roundedValue * 60;

    setTimerState((current) => ({
      ...current,
      secondsLeft: seconds,
      running: false,
      endTime: null,
      ...(mode === "focus"
        ? { focusMinutes: roundedValue }
        : { breakMinutes: roundedValue }),
    }));

    setCustomMinutes("");
  };

  const setPresetTime = (minutes) => {
    setTimerState((current) => ({
      ...current,
      secondsLeft: minutes * 60,
      running: false,
      endTime: null,
      ...(mode === "focus"
        ? { focusMinutes: minutes }
        : { breakMinutes: minutes }),
    }));
  };

  const toggleTimer = () => {
    if (running) {
      const remaining = endTime
        ? Math.max(0, Math.ceil((endTime - Date.now()) / 1000))
        : secondsLeft;

      setTimerState((current) => ({
        ...current,
        secondsLeft: remaining,
        running: false,
        endTime: null,
      }));
      return;
    }

    if (secondsLeft <= 0) {
      const resetSeconds =
        (mode === "focus" ? focusMinutes : breakMinutes) * 60;

      setTimerState((current) => ({
        ...current,
        secondsLeft: resetSeconds,
        running: true,
        endTime: Date.now() + resetSeconds * 1000,
      }));
      return;
    }

    setTimerState((current) => ({
      ...current,
      running: true,
      endTime: Date.now() + current.secondsLeft * 1000,
    }));
  };

  const resetTimer = () => {
    const resetSeconds =
      (mode === "focus" ? focusMinutes : breakMinutes) * 60;

    setTimerState((current) => ({
      ...current,
      secondsLeft: resetSeconds,
      running: false,
      endTime: null,
    }));
  };

  const minutes = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const seconds = String(secondsLeft % 60).padStart(2, "0");

  return (
    <div className="panel focus-timer-panel">
      <div className="panel-header">
        <div>
          <h2>Focus Timer</h2>
          <p className="panel-subtitle">
            {mode === "focus"
              ? `${focusMinutes}-minute study session`
              : `${breakMinutes}-minute break`}
          </p>
        </div>
        <span className="feature-icon">⏱️</span>
      </div>

      <div className="timer-mode-switch">
        <button
          className={mode === "focus" ? "active" : ""}
          onClick={() => changeMode("focus")}
        >
          Focus
        </button>
        <button
          className={mode === "break" ? "active" : ""}
          onClick={() => changeMode("break")}
        >
          Break
        </button>
      </div>

      <div className="timer-presets">
        {[15, 25, 45, 60].map((minutes) => (
          <button
            key={minutes}
            className={
              (mode === "focus" ? focusMinutes : breakMinutes) === minutes
                ? "active"
                : ""
            }
            onClick={() => setPresetTime(minutes)}
            disabled={running}
          >
            {minutes}m
          </button>
        ))}
      </div>

      <div className="timer-custom-row">
        <input
          type="number"
          min="1"
          max="180"
          value={customMinutes}
          onChange={(event) => setCustomMinutes(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              applyCustomTime();
            }
          }}
          placeholder="Custom minutes"
          disabled={running}
        />
        <button
          className="secondary-action"
          onClick={applyCustomTime}
          disabled={running || !customMinutes}
        >
          Set Time
        </button>
      </div>

      <div className="timer-display">
        {minutes}:{seconds}
      </div>

      <div className="timer-actions">
        <button
          className="primary-action"
          onClick={toggleTimer}
        >
          {running ? "Pause" : secondsLeft === 0 ? "Restart" : "Start"}
        </button>
        <button
          className="secondary-action"
          onClick={resetTimer}
        >
          Reset
        </button>
      </div>

      <p className="timer-persistence-note">
        Set your own time. Timer continues even when you switch pages.
      </p>
    </div>
  );
}

function Dashboard({
  tasks,
  setShowForm,
  setFormData,
  onEdit,
  onDelete,
  onToggleComplete,
}) {
  const assignments =
    tasks.filter(
      (task) =>
        task.type === "assignment"
    );

  const exams =
    tasks.filter(
      (task) =>
        task.type === "exam"
    );

  const events =
    tasks.filter(
      (task) =>
        task.type === "event"
    );

  const pendingTasks =
    tasks.filter(
      (task) => !task.completed
    );

  const completedTasks =
    tasks.filter(
      (task) => task.completed
    );

  const totalTasks = tasks.length;

  const completionPercentage =
    totalTasks === 0
      ? 0
      : Math.round(
          (completedTasks.length /
            totalTasks) *
            100
        );

  const overdueTasks =
    tasks.filter(
      (task) =>
        !task.completed &&
        getDeadlineStatus(task)
          .className === "overdue"
    );

  const dueTodayTasks =
    tasks.filter(
      (task) =>
        !task.completed &&
        getDeadlineStatus(task)
          .className ===
          "today-deadline"
    );

  const tomorrowTasks =
    tasks.filter(
      (task) =>
        !task.completed &&
        getDeadlineStatus(task)
          .className === "tomorrow"
    );

  const upcomingTasks =
    tasks.filter(
      (task) =>
        !task.completed &&
        getDeadlineStatus(task)
          .className === "upcoming"
    );

  const openAddForm = (type) => {
    setFormData({
      title: "",
      subject: "",
      dueDate: "",
      priority: "Medium",
      type,
    });

    setShowForm(true);
  };

  return (
    <>
      <header>
        <div>
          <h1>Good morning 👋</h1>

          <p>
            Here's what's happening
            on your campus.
          </p>
        </div>

        <button
          onClick={() =>
            openAddForm(
              "assignment"
            )
          }
        >
          + Add Task
        </button>
      </header>

      <section className="stats">
        <div className="card">
          <span>Assignments</span>

          <h2>
            {assignments.length}
          </h2>

          <small>
            From your database
          </small>
        </div>

        <div className="card">
          <span>
            Upcoming Exams
          </span>

          <h2>{exams.length}</h2>

          <small>
            Upcoming examinations
          </small>
        </div>

        <div className="card">
          <span>Events</span>

          <h2>{events.length}</h2>

          <small>
            Campus activities
          </small>
        </div>

        <div className="card">
          <span>Pending Tasks</span>

          <h2>{pendingTasks.length}</h2>

          <small>
            {completedTasks.length} completed
          </small>
        </div>
      </section>

      <section className="dashboard-analytics">
        <div className="progress-card">
          <div className="progress-header">
            <div>
              <span>Task Progress</span>

              <h2>
                {completionPercentage}%
              </h2>
            </div>

            <div className="progress-icon">
              ✓
            </div>
          </div>

          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{
                width: `${completionPercentage}%`,
              }}
            />
          </div>

          <p>
            {completedTasks.length} of{" "}
            {totalTasks} tasks completed
          </p>
        </div>

        <div className="deadline-card">
          <div className="progress-header">
            <div>
              <span>Deadline Overview</span>

              <h2>
                {overdueTasks.length +
                  dueTodayTasks.length}
              </h2>
            </div>

            <div className="progress-icon">
              🔔
            </div>
          </div>

          <div className="deadline-summary">
            <span className="deadline-summary-item overdue-text">
              <strong>
                {overdueTasks.length}
              </strong>
              Overdue
            </span>

            <span className="deadline-summary-item today-text">
              <strong>
                {dueTodayTasks.length}
              </strong>
              Today
            </span>

            <span className="deadline-summary-item tomorrow-text">
              <strong>
                {tomorrowTasks.length}
              </strong>
              Tomorrow
            </span>

            <span className="deadline-summary-item upcoming-text">
              <strong>
                {upcomingTasks.length}
              </strong>
              Upcoming
            </span>
          </div>
        </div>
      </section>

      <section
        className="panel"
        style={{
          marginBottom: "22px",
        }}
      >
        <div className="panel-header">
          <h2>Quick Actions</h2>
        </div>

        <div className="quick-actions">
          <button
            onClick={() =>
              openAddForm(
                "assignment"
              )
            }
          >
            📝
            <br />
            Add Assignment
          </button>

          <button
            onClick={() =>
              openAddForm("exam")
            }
          >
            🧪
            <br />
            Add Exam
          </button>

          <button
            onClick={() =>
              openAddForm("event")
            }
          >
            🎯
            <br />
            Add Event
          </button>

        </div>
      </section>

      <section className="dashboard-main-grid">
        <TodayFocus
          tasks={tasks}
          onEdit={onEdit}
          onDelete={onDelete}
          onToggleComplete={onToggleComplete}
        />

        <SubjectOverview tasks={tasks} />

        <div className="panel">
          <div className="panel-header">
            <h2>Upcoming</h2>

            <Link to="/calendar">
              View all
            </Link>
          </div>

          {tasks.length === 0 ? (
            <p className="empty-panel-text">
              No upcoming tasks.
            </p>
          ) : (
            tasks
              .filter((task) => !task.completed)
              .slice(0, 5)
              .map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onToggleComplete={
                    onToggleComplete
                  }
                />
              ))
          )}
        </div>
      </section>

      <section className="dashboard-feature-grid">
        <WeeklyWorkload tasks={tasks} />

        <SmartFocus
          tasks={tasks}
          onEdit={onEdit}
          onToggleComplete={onToggleComplete}
        />

        <FocusTimer />
      </section>
    </>
  );
}


function ResourcesHub({ token }) {
  const [resources, setResources] = useState([]);
  const [subject, setSubject] = useState("");
  const [title, setTitle] = useState("");
  const [resourceType, setResourceType] = useState("Website");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState(null);
  const [search, setSearch] = useState("");
  const [fileError, setFileError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadResources = async () => {
    try {
      const response = await campusApiFetch("/api/resources", token);
      if (!response.ok) throw new Error("Failed to load resources.");
      setResources(await response.json());
    } catch (error) {
      console.error(error);
      alert("Could not load study resources.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadResources();
  }, [token]);

  const handleResourceTypeChange = (event) => {
    setResourceType(event.target.value);
    setUrl("");
    setFile(null);
    setFileError("");
  };

  const handleFileChange = (event) => {
    const selectedFile = event.target.files?.[0];
    setFileError("");

    if (!selectedFile) {
      setFile(null);
      return;
    }

    const isAllowed =
      selectedFile.type === "application/pdf" ||
      selectedFile.type.startsWith("image/");

    if (!isAllowed) {
      setFile(null);
      event.target.value = "";
      setFileError("Please upload a PDF or image file.");
      return;
    }

    if (selectedFile.size > 3 * 1024 * 1024) {
      setFile(null);
      event.target.value = "";
      setFileError("File must be 3 MB or smaller.");
      return;
    }

    setFile(selectedFile);
  };

  const addResource = async (event) => {
    event.preventDefault();

    if (!subject.trim() || !title.trim()) return;

    if (resourceType === "Website" && !url.trim()) return;

    if (resourceType === "File" && !file) {
      setFileError("Choose a PDF or image file first.");
      return;
    }

    setSaving(true);

    try {
      let payload;

      if (resourceType === "Website") {
        payload = {
          subject: subject.trim(),
          title: title.trim(),
          type: "Website",
          url: url.trim(),
        };
      } else {
        const fileData = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(new Error("Could not read file."));
          reader.readAsDataURL(file);
        });

        payload = {
          subject: subject.trim(),
          title: title.trim(),
          type: file.type === "application/pdf" ? "PDF" : "Image",
          fileName: file.name,
          fileData,
          mimeType: file.type,
        };
      }

      const response = await campusApiFetch("/api/resources", token, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to add resource.");
      }

      const created = await response.json();
      setResources((current) => [created, ...current]);

      setSubject("");
      setTitle("");
      setUrl("");
      setFile(null);
      setFileError("");

      const input = document.getElementById("resource-file-input");
      if (input) input.value = "";
    } catch (error) {
      console.error(error);
      setFileError(error.message || "Could not add resource.");
    } finally {
      setSaving(false);
    }
  };

  const deleteResource = async (id) => {
    if (!window.confirm("Delete this resource?")) return;

    try {
      const response = await campusApiFetch(`/api/resources/${id}`, token, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete resource.");

      setResources((current) =>
        current.filter((resource) => resource.id !== id)
      );
    } catch (error) {
      console.error(error);
      alert("Could not delete resource.");
    }
  };

  const filtered = resources.filter((item) =>
    `${item.subject} ${item.title} ${item.type} ${item.fileName || ""}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Study Resources</h1>
          <p>Keep your subject resources and important study files in one place.</p>
        </div>
      </div>

      <section className="resources-layout">
        <div className="panel resource-form-panel">
          <div className="panel-header">
            <div>
              <h2>Add Resource</h2>
              <p className="panel-subtitle">Save a website or upload a PDF/image.</p>
            </div>
            <span className="feature-icon">📚</span>
          </div>

          <form className="resource-form" onSubmit={addResource}>
            <label>Subject</label>
            <input
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="e.g. DBMS"
              required
            />

            <label>Resource Title</label>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Unit 1 Notes"
              required
            />

            <label>Resource Type</label>
            <select value={resourceType} onChange={handleResourceTypeChange}>
              <option value="Website">Website Link</option>
              <option value="File">Upload File</option>
            </select>

            {resourceType === "Website" ? (
              <div className="resource-input-group">
                <label>Website URL</label>
                <input
                  type="url"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://example.com"
                  required
                />
              </div>
            ) : (
              <div className="resource-input-group">
                <label>Choose PDF or Image</label>
                <input
                  id="resource-file-input"
                  className="resource-file-input"
                  type="file"
                  accept="application/pdf,image/*"
                  onChange={handleFileChange}
                  required
                />
                <small className="resource-file-hint">
                  Maximum 3 MB · PDF or image
                </small>
                {file && (
                  <small className="resource-selected-file">
                    Selected: {file.name}
                  </small>
                )}
                {fileError && (
                  <small className="resource-file-error">{fileError}</small>
                )}
              </div>
            )}

            <button className="submit-button" type="submit" disabled={saving}>
              {saving ? "Saving..." : "Add Resource"}
            </button>
          </form>
        </div>

        <div className="panel resources-list-panel">
          <div className="panel-header">
            <div>
              <h2>My Resources</h2>
              <p className="panel-subtitle">
                {resources.length} saved resource{resources.length !== 1 ? "s" : ""}
              </p>
            </div>
            <input
              className="resource-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search..."
            />
          </div>

          {loading ? (
            <div className="empty-feature-state">
              <p>Loading resources...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty-feature-state">
              <span>🔎</span>
              <p>No resources found.</p>
            </div>
          ) : (
            <div className="resource-list">
              {filtered.map((item) => (
                <div className="resource-card" key={item.id}>
                  <div className="resource-type">{item.type}</div>

                  <div className="resource-card-body">
                    <span className="resource-subject">{item.subject}</span>
                    <h3>{item.title}</h3>

                    {item.type === "Website" ? (
                      <a href={item.url} target="_blank" rel="noreferrer">
                        Open website ↗
                      </a>
                    ) : (
                      <a
                        href={item.fileData}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open {item.type.toLowerCase()} ↗
                      </a>
                    )}

                    {item.fileName && (
                      <small className="resource-file-name">
                        {item.fileName}
                      </small>
                    )}
                  </div>

                  <button
                    className="icon-delete-button"
                    onClick={() => deleteResource(item.id)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}


function QuickNotes() {
  const [notes, setNotes] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("campusosNotes")) || [];
    } catch {
      return [];
    }
  });
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [search, setSearch] = useState("");

  const saveNotes = (items) => {
    setNotes(items);
    localStorage.setItem("campusosNotes", JSON.stringify(items));
  };

  const addNote = (event) => {
    event.preventDefault();
    if (!body.trim()) return;
    saveNotes([
      { id: Date.now(), title: title.trim() || "Quick Note", body: body.trim(), pinned: false },
      ...notes,
    ]);
    setTitle("");
    setBody("");
  };

  const togglePin = (id) => {
    saveNotes(notes.map((note) => note.id === id ? { ...note, pinned: !note.pinned } : note));
  };

  const filtered = notes
    .filter((note) => `${note.title} ${note.body}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned));

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Quick Notes</h1>
          <p>Capture ideas, reminders and study points without leaving CampusOS.</p>
        </div>
      </div>

      <section className="notes-layout">
        <div className="panel note-editor-panel">
          <div className="panel-header">
            <div><h2>New Note</h2><p className="panel-subtitle">Write something you don't want to forget.</p></div>
            <span className="feature-icon">📝</span>
          </div>
          <form className="note-form" onSubmit={addNote}>
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Note title" />
            <textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="Start typing..." rows="9" required />
            <button className="submit-button" type="submit">Save Note</button>
          </form>
        </div>

        <div className="panel notes-list-panel">
          <div className="panel-header">
            <div><h2>My Notes</h2><p className="panel-subtitle">{notes.length} note{notes.length !== 1 ? "s" : ""}</p></div>
            <input className="resource-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search notes..." />
          </div>
          {filtered.length === 0 ? (
            <div className="empty-feature-state"><span>📝</span><p>Your saved notes will appear here.</p></div>
          ) : (
            <div className="note-grid">
              {filtered.map((note) => (
                <article className={`note-card ${note.pinned ? "pinned" : ""}`} key={note.id}>
                  <div className="note-card-top">
                    <h3>{note.title}</h3>
                    <button className="pin-button" onClick={() => togglePin(note.id)}>{note.pinned ? "📌" : "📍"}</button>
                  </div>
                  <p>{note.body}</p>
                  <div className="note-card-footer">
                    <small>{new Date(note.id).toLocaleDateString("en-US", { day: "2-digit", month: "short" })}</small>
                    <button className="text-delete-button" onClick={() => saveNotes(notes.filter((item) => item.id !== note.id))}>Delete</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}


function AttendanceTracker({ token }) {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);

  const [form, setForm] = useState({
    subject: "",
    lastWorkingDay: "",
    classesPerWeek: "",
    target: "75",
    attended: "",
    total: "",
  });

  const loadAttendance = async () => {
    try {
      const response = await campusApiFetch("/api/attendance", token);
      if (!response.ok) throw new Error("Failed to load attendance.");
      setSubjects(await response.json());
    } catch (error) {
      console.error(error);
      alert("Could not load attendance data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAttendance();
  }, [token]);

  const countWorkingDays = (startDate, endDate) => {
    if (!startDate || !endDate) return 0;

    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T00:00:00`);

    if (end < start) return 0;

    let count = 0;
    const current = new Date(start);

    while (current <= end) {
      const day = current.getDay();

      if (day !== 0 && day !== 6) {
        count += 1;
      }

      current.setDate(current.getDate() + 1);
    }

    return count;
  };

  const resetForm = () => {
    setEditingId(null);
    setForm({
      subject: "",
      lastWorkingDay: "",
      classesPerWeek: "",
      target: "75",
      attended: "",
      total: "",
    });
  };

  const saveAttendance = async (event) => {
    event.preventDefault();

    const attended = Number(form.attended);
    const total = Number(form.total);
    const classesPerWeek = Number(form.classesPerWeek);
    const target = Number(form.target);

    if (
      !form.subject.trim() ||
      !form.lastWorkingDay ||
      classesPerWeek <= 0 ||
      total < 0 ||
      attended < 0 ||
      attended > total ||
      target < 1 ||
      target > 100
    ) {
      alert("Please enter valid attendance details.");
      return;
    }

    const payload = {
      subject: form.subject.trim(),
      lastWorkingDay: form.lastWorkingDay,
      classesPerWeek,
      target,
      attended,
      total,
    };

    try {
      const response = await campusApiFetch(
        editingId !== null
          ? `/api/attendance/${editingId}`
          : "/api/attendance",
        token,
        {
          method: editingId !== null ? "PUT" : "POST",
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Could not save attendance.");
      }

      const saved = await response.json();

      setSubjects((current) =>
        editingId !== null
          ? current.map((item) =>
              item.id === editingId ? saved : item
            )
          : [saved, ...current]
      );

      resetForm();
    } catch (error) {
      console.error(error);
      alert(error.message || "Could not save attendance.");
    }
  };

  const editAttendance = (subject) => {
    setEditingId(subject.id);

    setForm({
      subject: subject.subject || "",
      lastWorkingDay: subject.lastWorkingDay || "",
      classesPerWeek: String(subject.classesPerWeek ?? ""),
      target: String(subject.target ?? 75),
      attended: String(subject.attended ?? ""),
      total: String(subject.total ?? ""),
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this subject's attendance data?")) return;

    try {
      const response = await campusApiFetch(
        `/api/attendance/${id}`,
        token,
        { method: "DELETE" }
      );

      if (!response.ok) throw new Error("Could not delete attendance.");

      setSubjects((current) =>
        current.filter((item) => item.id !== id)
      );

      if (editingId === id) {
        resetForm();
      }
    } catch (error) {
      console.error(error);
      alert("Could not delete attendance.");
    }
  };

  const stats = (s) => {
    const pct = s.total ? (s.attended / s.total) * 100 : 0;

    const today = new Date();
    const todayKey =
      today.getFullYear() +
      "-" +
      String(today.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(today.getDate()).padStart(2, "0");

    const startDate =
      todayKey <= s.lastWorkingDay
        ? todayKey
        : s.lastWorkingDay;

    const workingDaysLeft = countWorkingDays(
      startDate,
      s.lastWorkingDay
    );

    const scheduledClasses = Math.max(
      0,
      Math.round((workingDaysLeft / 5) * s.classesPerWeek)
    );

    // Assume 10% of scheduled classes are lost to holidays/cancellations.
    const expectedClassesLeft = Math.max(
      0,
      Math.round(scheduledClasses * 0.9)
    );

    const finalTotal = s.total + expectedClassesLeft;

    const classesNeeded = Math.max(
      0,
      Math.ceil((s.target / 100) * finalTotal - s.attended)
    );

    const possibleToReachTarget =
      classesNeeded <= expectedClassesLeft;

    const maximumPossiblePercentage =
      finalTotal > 0
        ? ((s.attended + expectedClassesLeft) / finalTotal) * 100
        : 0;

    const classesToAttend = Math.min(
      expectedClassesLeft,
      classesNeeded
    );

    const safe = pct >= s.target;

    const canMiss =
      safe
        ? Math.max(
            0,
            Math.floor(
              (s.attended - (s.target / 100) * s.total) /
                (s.target / 100)
            )
          )
        : 0;

    return {
      pct,
      safe,
      workingDaysLeft,
      scheduledClasses,
      expectedClassesLeft,
      classesNeeded,
      classesToAttend,
      canMiss,
      possibleToReachTarget,
      maximumPossiblePercentage,
    };
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Attendance Tracker</h1>
          <p>
            Plan your attendance using working days, weekly classes and a
            realistic 10% cancellation/holiday allowance.
          </p>
        </div>
      </div>

      <form className="feature-form attendance-form" onSubmit={saveAttendance}>
        <input
          placeholder="Subject name"
          value={form.subject}
          onChange={(e) =>
            setForm({ ...form, subject: e.target.value })
          }
        />

        <div className="field-with-label">
          <label>Last working day</label>
          <input
            type="date"
            value={form.lastWorkingDay}
            onChange={(e) =>
              setForm({
                ...form,
                lastWorkingDay: e.target.value,
              })
            }
          />
        </div>

        <div className="field-with-label">
          <label>Classes per week</label>
          <input
            type="number"
            min="1"
            placeholder="e.g. 4"
            value={form.classesPerWeek}
            onChange={(e) =>
              setForm({
                ...form,
                classesPerWeek: e.target.value,
              })
            }
          />
        </div>

        <div className="field-with-label">
          <label>Minimum required %</label>
          <input
            type="number"
            min="1"
            max="100"
            placeholder="e.g. 75"
            value={form.target}
            onChange={(e) =>
              setForm({
                ...form,
                target: e.target.value,
              })
            }
          />
        </div>

        <div className="field-with-label">
          <label>Classes done</label>
          <input
            type="number"
            min="0"
            placeholder="e.g. 40"
            value={form.total}
            onChange={(e) =>
              setForm({
                ...form,
                total: e.target.value,
              })
            }
          />
        </div>

        <div className="field-with-label">
          <label>Classes attended</label>
          <input
            type="number"
            min="0"
            placeholder="e.g. 32"
            value={form.attended}
            onChange={(e) =>
              setForm({
                ...form,
                attended: e.target.value,
              })
            }
          />
        </div>

        <button className="primary-action" type="submit">
          {editingId !== null ? "Save Attendance" : "Add Subject"}
        </button>

        {editingId !== null && (
          <button
            className="secondary-action"
            type="button"
            onClick={resetForm}
          >
            Cancel Edit
          </button>
        )}
      </form>

      <div className="feature-grid">
        {loading ? (
          <div className="empty-feature">
            <p>Loading attendance...</p>
          </div>
        ) : subjects.length === 0 ? (
          <div className="empty-feature">
            <span>🎓</span>
            <h3>No subjects added</h3>
            <p>Add your first subject to start tracking attendance.</p>
          </div>
        ) : (
          subjects.map((s) => {
            const x = stats(s);

            return (
              <div className="feature-card" key={s.id}>
                <div className="feature-card-top">
                  <div>
                    <h3>{s.subject}</h3>
                    <p>
                      {s.attended} / {s.total} classes attended
                    </p>
                  </div>

                  <button
                    className="icon-button danger"
                    onClick={() => remove(s.id)}
                  >
                    ×
                  </button>
                </div>

                <div className="attendance-percent">
                  {x.pct.toFixed(1)}%
                </div>

                <div className="progress-track">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${Math.min(100, x.pct)}%`,
                    }}
                  />
                </div>

                <div className="attendance-stats">
                  <div>
                    <strong>{x.workingDaysLeft}</strong>
                    <span>Working days left</span>
                  </div>

                  <div>
                    <strong>{x.expectedClassesLeft}</strong>
                    <span>Expected classes left</span>
                  </div>

                  <div>
                    <strong>{s.target}%</strong>
                    <span>Minimum required</span>
                  </div>
                </div>

                <div
                  className={`attendance-status ${
                    x.safe
                      ? "safe"
                      : x.possibleToReachTarget
                      ? "short"
                      : "impossible"
                  }`}
                >
                  {x.safe
                    ? `🟢 Safe · You can miss approximately ${x.canMiss} more class${
                        x.canMiss === 1 ? "" : "es"
                      } and stay around ${s.target}%`
                    : x.possibleToReachTarget
                    ? `🔴 Shortage · You need to attend ${
                        x.classesToAttend
                      } of the expected ${x.expectedClassesLeft} remaining classes`
                    : `⚠️ Target not reachable · Even with attendance in all ${
                        x.expectedClassesLeft
                      } expected classes, the projected maximum is ${x.maximumPossiblePercentage.toFixed(
                        1
                      )}%`}
                </div>

                <div className="attendance-extra">
                  <span>
                    Last working day:{" "}
                    <strong>{s.lastWorkingDay}</strong>
                  </span>

                  <span>
                    Classes/week:{" "}
                    <strong>{s.classesPerWeek}</strong>
                  </span>

                  <span>
                    Scheduled estimate:{" "}
                    <strong>{x.scheduledClasses}</strong>
                  </span>

                  <span>
                    10% allowance applied:{" "}
                    <strong>{x.expectedClassesLeft}</strong>
                  </span>
                </div>

                <button
                  className="secondary-action attendance-edit-button"
                  type="button"
                  onClick={() => editAttendance(s)}
                >
                  Edit Attendance
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}


function CGPACalculator({ token }) {
  const [semesters, setSemesters] = useState([]);
  const [semesterName, setSemesterName] = useState("Semester 1");
  const [current, setCurrent] = useState([]);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    name: "",
    credits: "",
    grade: "",
  });

  const gradePoints = {
    O: 10,
    "A+": 9,
    A: 8,
    "B+": 7,
    B: 6,
    C: 5,
    D: 4,
    F: 0,
  };

  const loadCgpa = async () => {
    try {
      const response = await campusApiFetch("/api/cgpa", token);
      if (!response.ok) throw new Error("Failed to load CGPA data.");

      const data = await response.json();

      setSemesters(Array.isArray(data.semesters) ? data.semesters : []);
      setCurrent(
        Array.isArray(data.currentSubjects)
          ? data.currentSubjects
          : []
      );
      setSemesterName(data.semesterName || "Semester 1");
    } catch (error) {
      console.error(error);
      alert("Could not load CGPA data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCgpa();
  }, [token]);

  const currentGPA = () => {
    const credits = current.reduce(
      (sum, item) => sum + Number(item.credits || 0),
      0
    );

    if (!credits) return 0;

    return (
      current.reduce(
        (sum, item) =>
          sum +
          Number(item.credits || 0) *
            Number(gradePoints[item.grade] ?? 0),
        0
      ) / credits
    );
  };

  const saveData = async (nextSemesters, nextCurrent, nextName) => {
    const response = await campusApiFetch("/api/cgpa", token, {
      method: "PUT",
      body: JSON.stringify({
        semesters: nextSemesters,
        currentSubjects: nextCurrent,
        semesterName: nextName,
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || "Could not save CGPA data.");
    }
  };

  const add = async (event) => {
    event.preventDefault();

    if (
      !form.name.trim() ||
      Number(form.credits) <= 0 ||
      !(form.grade in gradePoints)
    ) {
      alert("Enter a subject, valid credits and grade.");
      return;
    }

    const nextCurrent = [
      ...current,
      {
        id: Date.now(),
        name: form.name.trim(),
        credits: Number(form.credits),
        grade: form.grade,
      },
    ];

    try {
      await saveData(semesters, nextCurrent, semesterName);
      setCurrent(nextCurrent);
      setForm({
        name: "",
        credits: "",
        grade: "",
      });
    } catch (error) {
      console.error(error);
      alert(error.message || "Could not save subject.");
    }
  };

  const saveSemester = async () => {
    if (!current.length) {
      alert("Add at least one subject first.");
      return;
    }

    const gpa = Number(currentGPA().toFixed(2));

    const nextSemesters = [
      {
        id: Date.now(),
        name:
          semesterName.trim() ||
          `Semester ${semesters.length + 1}`,
        gpa,
      },
      ...semesters,
    ];

    const nextName = `Semester ${nextSemesters.length + 1}`;

    try {
      await saveData(nextSemesters, [], nextName);
      setSemesters(nextSemesters);
      setCurrent([]);
      setSemesterName(nextName);
    } catch (error) {
      console.error(error);
      alert(error.message || "Could not save semester.");
    }
  };

  const deleteSemester = async (id) => {
    const nextSemesters = semesters.filter(
      (semester) => semester.id !== id
    );

    try {
      await saveData(nextSemesters, current, semesterName);
      setSemesters(nextSemesters);
    } catch (error) {
      console.error(error);
      alert(error.message || "Could not delete semester.");
    }
  };

  const cgpa = semesters.length
    ? semesters.reduce((sum, semester) => sum + Number(semester.gpa), 0) /
      semesters.length
    : 0;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>CGPA Calculator</h1>
          <p>
            Your semester history and current calculation are synced to your
            CampusOS account.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="empty-feature">
          <p>Loading CGPA...</p>
        </div>
      ) : (
        <div className="calculator-layout">
          <div className="feature-card">
            <h2>Current Semester</h2>

            <div className="gpa-big">
              {currentGPA().toFixed(2)}
            </div>

            <form
              className="feature-form stacked"
              onSubmit={add}
            >
              <input
                placeholder="Subject"
                value={form.name}
                onChange={(e) =>
                  setForm({
                    ...form,
                    name: e.target.value,
                  })
                }
              />

              <input
                type="number"
                min="1"
                placeholder="Credits"
                value={form.credits}
                onChange={(e) =>
                  setForm({
                    ...form,
                    credits: e.target.value,
                  })
                }
              />

              <select
                value={form.grade}
                onChange={(e) =>
                  setForm({
                    ...form,
                    grade: e.target.value,
                  })
                }
              >
                <option value="">Select grade</option>
                {Object.keys(gradePoints).map((grade) => (
                  <option key={grade} value={grade}>
                    {grade} — {gradePoints[grade]} points
                  </option>
                ))}
              </select>

              <button
                className="primary-action"
                type="submit"
              >
                Add Subject
              </button>
            </form>

            {current.map((item) => (
              <div className="table-row" key={item.id}>
                <span>{item.name}</span>
                <span>{item.credits} cr</span>
                <strong>{item.grade}</strong>
              </div>
            ))}

            <div className="semester-save">
              <input
                value={semesterName}
                onChange={(e) =>
                  setSemesterName(e.target.value)
                }
              />

              <button
                className="secondary-action"
                type="button"
                onClick={saveSemester}
              >
                Save Semester
              </button>
            </div>
          </div>

          <div className="feature-card cgpa-summary">
            <h2>Overall CGPA</h2>

            <div className="cgpa-circle">
              {cgpa.toFixed(2)}
            </div>

            <p>
              {semesters.length} semester
              {semesters.length === 1 ? "" : "s"} saved
            </p>

            {semesters.map((semester) => (
              <div className="table-row" key={semester.id}>
                <span>{semester.name}</span>

                <strong>{Number(semester.gpa).toFixed(2)}</strong>

                <button
                  className="icon-button danger"
                  type="button"
                  onClick={() => deleteSemester(semester.id)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


function CollegeTimetable({ token }) {
  const days = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    day: "Monday",
    time: "09:00",
    subject: "",
    room: "",
    faculty: "",
  });

  const loadTimetable = async () => {
    try {
      const response = await campusApiFetch("/api/timetable", token);
      if (!response.ok) throw new Error("Failed to load timetable.");
      setEntries(await response.json());
    } catch (error) {
      console.error(error);
      alert("Could not load timetable.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTimetable();
  }, [token]);

  const add = async (event) => {
    event.preventDefault();

    if (!form.subject.trim()) {
      alert("Enter a subject.");
      return;
    }

    try {
      const response = await campusApiFetch("/api/timetable", token, {
        method: "POST",
        body: JSON.stringify({
          ...form,
          subject: form.subject.trim(),
          room: form.room.trim(),
          faculty: form.faculty.trim(),
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Could not add class.");
      }

      const created = await response.json();

      setEntries((current) => [...current, created]);

      setForm({
        day: form.day,
        time: form.time,
        subject: "",
        room: "",
        faculty: "",
      });
    } catch (error) {
      console.error(error);
      alert(error.message || "Could not add class.");
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Remove this class?")) return;

    try {
      const response = await campusApiFetch(
        `/api/timetable/${id}`,
        token,
        { method: "DELETE" }
      );

      if (!response.ok) throw new Error("Could not remove class.");

      setEntries((current) =>
        current.filter((entry) => entry.id !== id)
      );
    } catch (error) {
      console.error(error);
      alert("Could not remove class.");
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>College Timetable</h1>
          <p>
            Your weekly classes are synced to your CampusOS account.
          </p>
        </div>
      </div>

      <form
        className="feature-form timetable-form"
        onSubmit={add}
      >
        <select
          value={form.day}
          onChange={(e) =>
            setForm({
              ...form,
              day: e.target.value,
            })
          }
        >
          {days.map((day) => (
            <option key={day}>{day}</option>
          ))}
        </select>

        <input
          type="time"
          value={form.time}
          onChange={(e) =>
            setForm({
              ...form,
              time: e.target.value,
            })
          }
        />

        <input
          placeholder="Subject"
          value={form.subject}
          onChange={(e) =>
            setForm({
              ...form,
              subject: e.target.value,
            })
          }
        />

        <input
          placeholder="Room"
          value={form.room}
          onChange={(e) =>
            setForm({
              ...form,
              room: e.target.value,
            })
          }
        />

        <input
          placeholder="Faculty"
          value={form.faculty}
          onChange={(e) =>
            setForm({
              ...form,
              faculty: e.target.value,
            })
          }
        />

        <button className="primary-action" type="submit">
          Add Class
        </button>
      </form>

      {loading ? (
        <div className="empty-feature">
          <p>Loading timetable...</p>
        </div>
      ) : (
        <div className="timetable-grid">
          {days.map((day) => {
            const dayEntries = entries
              .filter((entry) => entry.day === day)
              .sort((a, b) =>
                String(a.time).localeCompare(String(b.time))
              );

            return (
              <div className="day-column" key={day}>
                <div className="day-header">{day}</div>

                {dayEntries.map((entry) => (
                  <div
                    className="class-card"
                    key={entry.id}
                  >
                    <div className="class-time">
                      {entry.time}
                    </div>

                    <strong>{entry.subject}</strong>

                    <span>
                      {entry.room || "Room not set"}
                    </span>

                    <small>
                      {entry.faculty ||
                        "Faculty not set"}
                    </small>

                    <button
                      className="class-delete"
                      type="button"
                      onClick={() =>
                        remove(entry.id)
                      }
                    >
                      Remove
                    </button>
                  </div>
                ))}

                {dayEntries.length === 0 && (
                  <div className="day-empty">
                    No classes
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


function AuthPage({ onAuthenticated }) {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage("");

    const cleanEmail = email.trim().toLowerCase();

    if (mode === "signup" && !name.trim()) {
      setErrorMessage("Please enter your name.");
      return;
    }

    if (!cleanEmail || !password) {
      setErrorMessage("Please enter your email and password.");
      return;
    }

    if (password.length < 6) {
      setErrorMessage("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/auth/${mode === "login" ? "login" : "signup"}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(
            mode === "login"
              ? {
                  email: cleanEmail,
                  password,
                }
              : {
                  name: name.trim(),
                  email: cleanEmail,
                  password,
                }
          ),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Authentication failed.");
      }

      const auth = {
        token: data.token,
        user: data.user,
      };

      saveAuthSession(auth);
      onAuthenticated(auth);
    } catch (error) {
      console.error("Authentication failed:", error);
      setErrorMessage(error.message || "Could not connect to CampusOS.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="auth-logo">C</div>
          <div>
            <h1>CampusOS</h1>
            <p>Your personal campus operating system</p>
          </div>
        </div>

        <div className="auth-tabs">
          <button
            type="button"
            className={mode === "login" ? "active" : ""}
            onClick={() => {
              setMode("login");
              setErrorMessage("");
            }}
          >
            Login
          </button>
          <button
            type="button"
            className={mode === "signup" ? "active" : ""}
            onClick={() => {
              setMode("signup");
              setErrorMessage("");
            }}
          >
            Create Account
          </button>
        </div>

        <div className="auth-heading">
          <h2>{mode === "login" ? "Welcome back" : "Create your CampusOS account"}</h2>
          <p>
            {mode === "login"
              ? "Log in to continue to your dashboard."
              : "Create an account to keep your CampusOS data private to you."}
          </p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === "signup" && (
            <>
              <label htmlFor="auth-name">Full name</label>
              <input
                id="auth-name"
                type="text"
                placeholder="Enter your name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
                required
              />
            </>
          )}

          <label htmlFor="auth-email">Email</label>
          <input
            id="auth-email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />

          <label htmlFor="auth-password">Password</label>
          <input
            id="auth-password"
            type="password"
            placeholder="At least 6 characters"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            minLength={6}
            required
          />

          {errorMessage && (
            <div className="auth-error">
              {errorMessage}
            </div>
          )}

          <button className="auth-submit" type="submit" disabled={loading}>
            {loading
              ? "Please wait..."
              : mode === "login"
              ? "Login to CampusOS"
              : "Create CampusOS Account"}
          </button>
        </form>

        <p className="auth-footer">
          {mode === "login"
            ? "New to CampusOS? Use Create Account above."
            : "Already have an account? Switch to Login above."}
        </p>
      </div>
    </div>
  );
}

function AppContent({ user, token, onLogout }) {
  const [tasks, setTasks] =
    useState([]);

  const [showForm, setShowForm] =
    useState(false);

  const [editingTask, setEditingTask] =
    useState(null);

  const [formData, setFormData] =
    useState({
      title: "",
      subject: "",
      dueDate: "",
      priority: "Medium",
      type: "assignment",
    });

  const location =
    useLocation();

  const authFetch = async (url, options = {}) => {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.status === 401) {
      onLogout();
      throw new Error("Your session has expired. Please log in again.");
    }

    return response;
  };

  const loadTasks = () => {
    authFetch(
      `${API_BASE_URL}/api/tasks`
    )
      .then((response) => {
        if (!response.ok) {
          throw new Error(
            "Failed to fetch tasks"
          );
        }

        return response.json();
      })
      .then((data) => {
        setTasks(data);
      })
      .catch((error) => {
        console.error(
          "Failed to load tasks:",
          error
        );
      });
  };

  useEffect(() => {
    loadTasks();
  }, []);

  useEffect(() => {
    const migrateLegacyData = async () => {
      try {
        const flag = `campusosLegacyMigrated:${user.id}`;

        if (localStorage.getItem(flag)) {
          return;
        }

        const attendanceRaw =
          localStorage.getItem("campusosAttendance");
        const cgpaRaw =
          localStorage.getItem("campusosCGPA");
        const timetableRaw =
          localStorage.getItem("campusosTimetable");
        const resourcesRaw =
          localStorage.getItem("campusosResources");

        const hasLegacyData =
          attendanceRaw ||
          cgpaRaw ||
          timetableRaw ||
          resourcesRaw;

        if (!hasLegacyData) {
          localStorage.setItem(flag, "1");
          return;
        }

        const response = await campusApiFetch(
          "/api/data/migrate",
          token,
          {
            method: "POST",
            body: JSON.stringify({
              attendance: attendanceRaw
                ? JSON.parse(attendanceRaw)
                : [],
              cgpa: cgpaRaw
                ? JSON.parse(cgpaRaw)
                : {
                    semesters: [],
                    currentSubjects: [],
                    semesterName: "Semester 1",
                  },
              timetable: timetableRaw
                ? JSON.parse(timetableRaw)
                : [],
              resources: resourcesRaw
                ? JSON.parse(resourcesRaw)
                : [],
            }),
          }
        );

        if (response.ok) {
          localStorage.removeItem("campusosAttendance");
          localStorage.removeItem("campusosCGPA");
          localStorage.removeItem("campusosTimetable");
          localStorage.removeItem("campusosResources");
          localStorage.setItem(flag, "1");
        }
      } catch (error) {
        console.error("Legacy data migration failed:", error);
      }
    };

    migrateLegacyData();
  }, [token, user.id]);

  const handleChange = (event) => {
    setFormData({
      ...formData,
      [event.target.name]:
        event.target.value,
    });
  };

  const handleSubmit = async (
    event
  ) => {
    event.preventDefault();

    try {
      const url = editingTask
        ? `${API_BASE_URL}/api/tasks/${editingTask.id}`
        : `${API_BASE_URL}/api/tasks`;

      const method = editingTask
        ? "PUT"
        : "POST";

      const response = await authFetch(
        url,
        {
          method,
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            ...formData,
            completed:
              editingTask?.completed ||
              false,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          editingTask
            ? "Failed to update task"
            : "Failed to create task"
        );
      }

      setFormData({
        title: "",
        subject: "",
        dueDate: "",
        priority: "Medium",
        type: "assignment",
      });

      setEditingTask(null);
      setShowForm(false);

      loadTasks();
    } catch (error) {
      console.error(error);

      alert(
        editingTask
          ? "Could not update task."
          : "Could not add task."
      );
    }
  };

  const handleEdit = (task) => {
    setEditingTask(task);

    setFormData({
      title: task.title || "",
      subject: task.subject || "",
      dueDate: getTaskDateKey(task),
      priority:
        task.priority || "Medium",
      type: task.type || "task",
    });

    setShowForm(true);
  };

  const handleDelete = async (task) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${task.title}"?`
    );

    if (!confirmed) {
      return;
    }

    try {
      const response = await authFetch(
        `${API_BASE_URL}/api/tasks/${task.id}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error(
          "Failed to delete task"
        );
      }

      loadTasks();
    } catch (error) {
      console.error(error);

      alert(
        "Could not delete task."
      );
    }
  };

  const handleToggleComplete = async (
    task
  ) => {
    const newCompleted =
      !task.completed;

    try {
      const response = await authFetch(
        `${API_BASE_URL}/api/tasks/${task.id}/completed`,
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            completed:
              newCompleted,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          "Failed to update completion"
        );
      }

      const updatedTask =
        await response.json();

      setTasks((currentTasks) =>
        currentTasks.map(
          (currentTask) =>
            currentTask.id ===
            updatedTask.id
              ? updatedTask
              : currentTask
        )
      );
    } catch (error) {
      console.error(error);

      alert(
        "Could not update task status."
      );
    }
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingTask(null);

    setFormData({
      title: "",
      subject: "",
      dueDate: "",
      priority: "Medium",
      type: "assignment",
    });
  };

  const navItems = [
    {
      name: "Dashboard",
      path: "/",
    },
    {
      name: "Calendar",
      path: "/calendar",
    },
    {
      name: "Assignments",
      path: "/assignments",
    },
    {
      name: "Exams",
      path: "/exams",
    },
    {
      name: "Events",
      path: "/events",
    },
    {
      name: "Attendance",
      path: "/attendance",
    },
    {
      name: "CGPA Calculator",
      path: "/cgpa",
    },
    {
      name: "Timetable",
      path: "/timetable",
    },
    {
      name: "Resources",
      path: "/resources",
    },
  ];

  return (
    <div className="app">
      <aside className="sidebar">
        <h2>CampusOS</h2>

        <nav>
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={
                location.pathname ===
                item.path
                  ? "active"
                  : ""
              }
            >
              {item.name}
            </Link>
          ))}
        </nav>

        <div className="profile">
          <div className="avatar">
            A
          </div>

          <div>
            <strong>
              {user.name}
            </strong>

            <small>
              {user.email}
            </small>
          </div>
        </div>

        <button
          className="logout-button"
          type="button"
          onClick={onLogout}
        >
          Log out
        </button>
      </aside>

      <main className="main">
        <Routes>
          <Route
            path="/"
            element={
              <Dashboard
                tasks={tasks}
                setShowForm={
                  setShowForm
                }
                setFormData={
                  setFormData
                }
                onEdit={handleEdit}
                onDelete={handleDelete}
                onToggleComplete={
                  handleToggleComplete
                }
              />
            }
          />

          <Route
            path="/calendar"
            element={
              <Calendar
                tasks={tasks}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onToggleComplete={
                  handleToggleComplete
                }
              />
            }
          />

          <Route
            path="/assignments"
            element={
              <FilteredTaskPage
                title="Assignments"
                description="Manage and track your assignments."
                tasks={tasks}
                type="assignment"
                onEdit={handleEdit}
                onDelete={handleDelete}
                onToggleComplete={
                  handleToggleComplete
                }
              />
            }
          />

          <Route
            path="/exams"
            element={
              <FilteredTaskPage
                title="Exams"
                description="Manage and track your upcoming examinations."
                tasks={tasks}
                type="exam"
                onEdit={handleEdit}
                onDelete={handleDelete}
                onToggleComplete={
                  handleToggleComplete
                }
              />
            }
          />

          <Route
            path="/events"
            element={
              <FilteredTaskPage
                title="Events"
                description="Manage and track your campus events."
                tasks={tasks}
                type="event"
                onEdit={handleEdit}
                onDelete={handleDelete}
                onToggleComplete={
                  handleToggleComplete
                }
              />
            }
          />

          <Route
            path="/attendance"
            element={<AttendanceTracker token={token} />}
          />

          <Route
            path="/cgpa"
            element={<CGPACalculator token={token} />}
          />

          <Route
            path="/timetable"
            element={<CollegeTimetable token={token} />}
          />

          <Route
            path="/resources"
            element={<ResourcesHub token={token} />}
          />

        </Routes>
      </main>

      {showForm && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>
                {editingTask
                  ? "Edit Task"
                  : "Add Task"}
              </h2>

              <button
                className="close-button"
                onClick={closeForm}
              >
                ×
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
            >
              <label>
                Task Title
              </label>

              <input
                type="text"
                name="title"
                placeholder="Enter task title"
                value={
                  formData.title
                }
                onChange={
                  handleChange
                }
                required
              />

              <label>
                Subject
              </label>

              <input
                type="text"
                name="subject"
                placeholder="Enter subject"
                value={
                  formData.subject
                }
                onChange={
                  handleChange
                }
              />

              <label>
                Due Date
              </label>

              <input
                type="date"
                name="dueDate"
                value={
                  formData.dueDate
                }
                onChange={
                  handleChange
                }
                required
              />

              <label>
                Type
              </label>

              <select
                name="type"
                value={
                  formData.type
                }
                onChange={
                  handleChange
                }
              >
                <option value="assignment">
                  Assignment
                </option>

                <option value="exam">
                  Exam
                </option>

                <option value="event">
                  Event
                </option>

                <option value="task">
                  General Task
                </option>
              </select>

              <label>
                Priority
              </label>

              <select
                name="priority"
                value={
                  formData.priority
                }
                onChange={
                  handleChange
                }
              >
                <option value="High">
                  High
                </option>

                <option value="Medium">
                  Medium
                </option>

                <option value="Low">
                  Low
                </option>
              </select>

              <button
                className="submit-button"
                type="submit"
              >
                {editingTask
                  ? "Save Changes"
                  : "Add Task"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function App() {
  const [auth, setAuth] = useState(getSavedAuth);

  const handleAuthenticated = (nextAuth) => {
    saveAuthSession(nextAuth);
    setAuth(nextAuth);
  };

  const handleLogout = () => {
    localStorage.removeItem("campusosAuth");
    setAuth(null);
  };

  if (!auth) {
    return <AuthPage onAuthenticated={handleAuthenticated} />;
  }

  return (
    <BrowserRouter>
      <AppContent
        user={auth.user}
        token={auth.token}
        onLogout={handleLogout}
      />
    </BrowserRouter>
  );
}

export default App;