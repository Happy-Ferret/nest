import { Module } from './../../../src/';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { AuthMiddleware } from './auth.middleware';
import { MiddlewareBuilder } from '../../../src/core/middlewares/builder';

@Module({
    controllers: [ UsersController ],
    components: [
        UsersService
    ],
})
export class UsersModule {
    getContext() {
        return 'Test';
    }

    configure(builder: MiddlewareBuilder) {
        builder.use({
            middlewares: [ AuthMiddleware ],
            forRoutes: [ UsersController ],
        })
    }
}
