import React, { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector, connect } from 'react-redux';
import { Snackbar } from '@material-ui/core';
import { useHistory } from 'react-router-dom';

import { positionsActions, devicesActions, sessionActions } from './store';
import { useEffectAsync } from './reactHelper';
import { useTranslation } from './LocalizationProvider';
import { prefixString } from './common/stringUtils';

const SocketController = () => {
  const dispatch = useDispatch();
  const history = useHistory();
  const t = useTranslation();

  const authenticated = useSelector((state) => !!state.session.user);
  const devices = useSelector((state) => state.devices.items);

  const socketRef = useRef();

  const [events, setEvents] = useState([]);
  const [notification, setNotification] = useState({
    message: '',
    show: false,
  });

  const connectSocket = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}/api/socket`);
    socketRef.current = socket;

    socket.onerror = () => {
      setTimeout(() => connectSocket(), 60 * 1000);
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.devices) {
        dispatch(devicesActions.update(data.devices));
      }
      if (data.positions) {
        dispatch(positionsActions.update(data.positions));
      }
      if (data.events) {
        setEvents(data.events);
      }
    };
  };

  useEffectAsync(async () => {
    const response = await fetch('/api/server');
    if (response.ok) {
      dispatch(sessionActions.updateServer(await response.json()));
    }
  }, []);

  useEffectAsync(async () => {
    if (authenticated) {
      const response = await fetch('/api/devices');
      if (response.ok) {
        dispatch(devicesActions.refresh(await response.json()));
      }
      connectSocket();
      return () => {
        const socket = socketRef.current;
        if (socket) {
          socket.close();
        }
      };
    }
    const response = await fetch('/api/session');
    if (response.ok) {
      dispatch(sessionActions.updateUser(await response.json()));
    } else {
      history.push('/login');
    }
    return null;
  }, [authenticated]);

  useEffect(() => {
    events.forEach((event) => {
      setNotification({
        message: `${devices[event.deviceId]?.name}: ${t(prefixString('event', `${event.type}`))}`,
        show: true,
      });
      setTimeout(() => setNotification({ message: '', show: false }), 6000);
    });
  }, [events]);

  return (
    <Snackbar
      anchorOrigin={{
        vertical: 'bottom',
        horizontal: 'right',
      }}
      open={notification.show}
      autoHideDuration={5000}
      message={notification.message}
    />
  );
};

export default connect()(SocketController);
