import 'reflect-metadata';
import { NestGateway } from './interfaces/nest-gateway.interface';
import { Injectable } from '../common/interfaces/injectable.interface';
import { ObservableSocketServer } from './interfaces/observable-socket-server.interface';
import { InvalidSocketPortException } from './exceptions/invalid-socket-port.exception';
import { GatewayMetadataExplorer, MessageMappingProperties } from './gateway-metadata-explorer';
import { Subject } from 'rxjs/Subject';
import { SocketServerProvider } from './socket-server-provider';
import { NAMESPACE_METADATA, PORT_METADATA } from './constants';
import { Metatype } from '../common/interfaces/metatype.interface';

export class WebSocketsController {
    private readonly metadataExplorer = new GatewayMetadataExplorer();
    private readonly CONNECTION_EVENT = 'connection';
    private readonly DISCONNECT_EVENT = 'disconnect';

    constructor(private socketServerProvider: SocketServerProvider) {}

    hookGatewayIntoServer(instance: NestGateway, metatype: Metatype<Injectable>) {
        const namespace = Reflect.getMetadata(NAMESPACE_METADATA, metatype) || '';
        const port = Reflect.getMetadata(PORT_METADATA, metatype) || 80;

        if (!Number.isInteger(port)) {
            throw new InvalidSocketPortException(port, metatype);
        }
        this.subscribeObservableServer(instance, namespace, port);
    }

    subscribeObservableServer(instance: NestGateway, namespace: string, port: number) {
        const messageHandlers = this.metadataExplorer.explore(instance);
        const observableServer = this.socketServerProvider.scanForSocketServer(namespace, port);

        this.hookServerToProperties(instance, observableServer.server);
        this.subscribeEvents(instance, messageHandlers, observableServer);
    }

    subscribeEvents(
        instance: NestGateway,
        messageHandlers: MessageMappingProperties[],
        observableServer: ObservableSocketServer) {

        const {
            init,
            disconnect,
            connection,
            server
        } = observableServer;

        this.subscribeInitEvent(instance, init);
        init.next(server);

        server.on(
            this.CONNECTION_EVENT,
            this.getConnectionHandler(this, instance, messageHandlers, disconnect, connection)
        );
    }

    getConnectionHandler(
        context: WebSocketsController,
        instance: NestGateway,
        messageHandlers: MessageMappingProperties[],
        disconnect: Subject<any>,
        connection: Subject<any>) {

        return (client) => {
            context.subscribeConnectionEvent(instance, connection);
            connection.next(client);

            context.subscribeMessages(messageHandlers, client, instance);
            context.subscribeDisconnectEvent(instance, disconnect);

            client.on(context.DISCONNECT_EVENT, (client) => disconnect.next(client));
        }
    }

    subscribeInitEvent(instance: NestGateway, event: Subject<any>) {
        if (instance.afterInit) {
            event.subscribe(instance.afterInit.bind(instance));
        }
    }

    subscribeConnectionEvent(instance: NestGateway, event: Subject<any>) {
        if (instance.handleConnection) {
            event.subscribe(instance.handleConnection.bind(instance));
        }
    }

    subscribeDisconnectEvent(instance: NestGateway, event: Subject<any>) {
        if (instance.handleDisconnect) {
            event.subscribe(instance.handleDisconnect.bind(instance));
        }
    }

    subscribeMessages(messageHandlers: MessageMappingProperties[], client, instance: NestGateway) {
        messageHandlers.map(({ message, targetCallback }) => {
            client.on(message, targetCallback.bind(instance, client));
        });
    }

    private hookServerToProperties(instance: NestGateway, server) {
        for (const propertyKey of this.metadataExplorer.scanForServerHooks(instance)) {
            Reflect.set(instance, propertyKey, server);
        }
    }

}